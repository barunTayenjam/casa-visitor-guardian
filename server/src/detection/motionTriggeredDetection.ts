import { EventEmitter } from 'events';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DetectionResult, ObjectDetectionSettings } from './objectDetection.js';
import sharp from 'sharp';
import axios from 'axios';
import { getOpenCVServiceUrl } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MotionDetectionSettings {
  enabled: boolean;
  sensitivity: number; // 0.1-1.0 (lower = more sensitive)
  minArea: number; // Minimum motion area in pixels
  maxDetectionInterval: number; // Max seconds between detections
  motionCooldown: number; // Cooldown period after motion (ms)
  enableBatchTrigger: boolean; // Trigger batch processing on motion
}

export interface MotionDetectionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  motionLevel: number;
  frameCount: number;
  detectionFrames: string[];
  metadata: {
    maxConfidence: number;
    totalDetections: number;
    personCount: number;
    processingTime: number;
  };
  detections: Array<{
    class: string;
    confidence: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
}

export class MotionTriggeredDetection extends EventEmitter {
  private settings = new Map<string, MotionDetectionSettings>();
  private motionBuffers = new Map<string, Buffer[]>();
  private backgroundFrames = new Map<string, Buffer>();
  private lastMotionTimes = new Map<string, number>();
  private detectionInProgress = new Set<string>();
  private motionFrameQueue = new Map<string, string[]>();

  constructor() {
    super();
    this.initializeDefaultSettings();
  }

  private initializeDefaultSettings(): void {
    const defaultSettings: MotionDetectionSettings = {
      enabled: true,
      sensitivity: 0.2,  // Lower = more sensitive (0.1 = very sensitive)
      minArea: 300,      // Lower = detect smaller motion
      maxDetectionInterval: 30,
      motionCooldown: 2000,  // Faster cooldown (2s instead of 5s)
      enableBatchTrigger: true
    };

    this.settings.set('default', defaultSettings);
  }

  // Called after stream manager is ready to start periodic detection
  startPeriodicDetection(streamManager: any): void {
    console.log('[MotionDetection] Starting periodic detection');
    
    // Run object detection every 5 seconds regardless of motion
    setInterval(async () => {
      const cameraIds = Array.from(this.backgroundFrames.keys());
      for (const cameraId of cameraIds) {
        const frame = streamManager.getLastFrame(cameraId);
        if (frame && frame.length > 0) {
          await this.runDetection(cameraId, frame);
        }
      }
    }, 5000);
  }

  updateSettings(cameraId: string, settings: Partial<MotionDetectionSettings>): boolean {
    const currentSettings = this.settings.get(cameraId) || this.settings.get('default');
    if (!currentSettings) return false;

    const updatedSettings = { ...currentSettings, ...settings };
    this.settings.set(cameraId, updatedSettings);
    return true;
  }

  getSettings(cameraId: string): MotionDetectionSettings | null {
    return this.settings.get(cameraId) || this.settings.get('default') || null;
  }

  /**
    * Process frame for motion detection - lightweight, non-blocking
    */
  async processFrame(cameraId: string, frame: Buffer): Promise<void> {
    const settings = this.getSettings(cameraId);
    if (!settings || !settings.enabled) {
      return;
    }

    // Skip if detection already in progress for this camera
    if (this.detectionInProgress.has(cameraId)) {
      return;
    }

    // Skip if in cooldown period
    const lastMotion = this.lastMotionTimes.get(cameraId) || 0;
    if (Date.now() - lastMotion < settings.motionCooldown) {
      return;
    }

    // Lightweight motion check first
    const hasMotion = await this.lightweightMotionCheck(cameraId, frame, settings);
    if (!hasMotion) {
      return;
    }

    // Motion detected - trigger full detection asynchronously
    this.triggerFullDetection(cameraId, frame, settings);
  }

  /**
    * Lightweight motion detection using frame differencing
    */
  private async lightweightMotionCheck(cameraId: string, frame: Buffer, settings: MotionDetectionSettings): Promise<boolean> {
    try {
      // Initialize background frame if not exists
      if (!this.backgroundFrames.has(cameraId)) {
        this.backgroundFrames.set(cameraId, frame);
        return false;
      }

      const backgroundFrame = this.backgroundFrames.get(cameraId)!;
      
      // Quick frame differencing using Sharp for performance
      const motionLevel = await this.calculateMotionLevel(frame, backgroundFrame);
      
      // Update background periodically (slow adaptation)
      if (Math.random() < 0.01) { // 1% chance to update background
        this.backgroundFrames.set(cameraId, frame);
      }

      return motionLevel > (1 - settings.sensitivity);
    } catch (error) {
      console.error(`Lightweight motion check failed for ${cameraId}:`, error);
      return false;
    }
  }

  /**
   * Calculate motion level using image differencing
   */
  private async calculateMotionLevel(currentFrame: Buffer, backgroundFrame: Buffer): Promise<number> {
    try {
      // Validate JPEG headers first
      if (!this.isValidJpeg(currentFrame) || !this.isValidJpeg(backgroundFrame)) {
        return 0;
      }

      // Use Sharp for fast image processing
      const current = sharp(currentFrame);
      const background = sharp(backgroundFrame);
      
      // Get metadata for normalization
      const currentMeta = await current.metadata();
      const { width, height } = currentMeta;
      
      if (!width || !height) return 0;

      // Resize to small resolution for faster processing
      const resizeWidth = 160;
      const resizeHeight = Math.floor((height / width) * resizeWidth);
      
      // Calculate difference using composite operations
      const currentResized = await current.resize(resizeWidth, resizeHeight).raw().toBuffer();
      const backgroundResized = await background.resize(resizeWidth, resizeHeight).raw().toBuffer();

      // Manual differencing for better control
      const pixels1 = new Uint8ClampedArray(currentResized);
      const pixels2 = new Uint8ClampedArray(backgroundResized);
      let totalDiff = 0;
      
      // Calculate average difference per channel
      for (let i = 0; i < Math.min(pixels1.length, pixels2.length); i += 3) {
        const diff = Math.abs(pixels1[i] - pixels2[i]) + 
                    Math.abs(pixels1[i+1] - pixels2[i+1]) + 
                    Math.abs(pixels1[i+2] - pixels2[i+2]);
        totalDiff += diff / 3; // Average RGB difference
      }
      
      const avgDiff = totalDiff / (pixels1.length / 3);
      return Math.min(avgDiff / 255, 1); // Normalize to 0-1
      
    } catch (error) {
      console.error('Motion level calculation error:', error);
      return 0;
    }
  }

  /**
   * Check if buffer contains valid JPEG data
   */
  private isValidJpeg(buffer: Buffer): boolean {
    return buffer.length >= 4 && 
           buffer[0] === 0xFF && 
           buffer[1] === 0xD8 && 
           buffer[buffer.length-2] === 0xFF && 
           buffer[buffer.length-1] === 0xD9;
  }

  /**
   * Trigger full object detection on motion-detected frame
   */
  private async triggerFullDetection(cameraId: string, frame: Buffer, settings: MotionDetectionSettings): Promise<void> {
    // Mark detection as in progress
    this.detectionInProgress.add(cameraId);

    try {
      const startTime = Date.now();
      
      // Run full detection using OpenCV service
      const response = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, frame, {
        headers: {
          'Content-Type': 'image/jpeg'
        },
        timeout: 30000
      });
      
      const detections = response.data.detections;
      
      // Calculate event metadata
      const personCount = detections.filter(d => d.class === 'person').length;
      const maxConfidence = Math.max(...detections.map(d => d.confidence), 0);
      
      // Add frame to motion queue and save to DB with detections
      const framePath = await this.saveMotionFrame(cameraId, frame, detections);
      
      if (!this.motionFrameQueue.has(cameraId)) {
        this.motionFrameQueue.set(cameraId, []);
      }
      this.motionFrameQueue.get(cameraId)!.push(framePath);
      
      // Create motion detection event with full detection data
      const event: MotionDetectionEvent = {
        id: `motion_${cameraId}_${Date.now()}`,
        cameraId,
        timestamp: new Date().toISOString(),
        motionLevel: maxConfidence,
        frameCount: this.motionFrameQueue.get(cameraId)!.length,
        detectionFrames: [...this.motionFrameQueue.get(cameraId)!],
        metadata: {
          maxConfidence,
          totalDetections: detections.length,
          personCount,
          processingTime: Date.now() - startTime
        },
        // Include full detection results for frontend visualization
        detections: detections.map((d: any) => ({
          class: d.class,
          confidence: d.confidence,
          bbox: d.bbox
        }))
      };

      // Update motion timestamp
      this.lastMotionTimes.set(cameraId, Date.now());

      // Emit motion event
      this.emit('motionDetected', event);

      // Trigger batch processing if enabled
      if (settings.enableBatchTrigger && detections.length > 0) {
        this.emit('batchTrigger', {
          cameraId,
          event,
          frames: this.motionFrameQueue.get(cameraId)!
        });
      }

      // Cleanup old frames (keep only last 10)
      const frameQueue = this.motionFrameQueue.get(cameraId)!;
      if (frameQueue.length > 10) {
        const oldFrames = frameQueue.splice(0, frameQueue.length - 10);
        this.cleanupOldFrames(oldFrames);
      }

      // No OpenCV resources to cleanup - handled by the service

    } catch (error) {
      console.error(`Full detection failed for ${cameraId}:`, error);
    } finally {
      // Remove detection in progress flag
      this.detectionInProgress.delete(cameraId);
    }
  }

  /**
   * Run object detection on a frame (called periodically)
   */
  async runDetection(cameraId: string, frame: Buffer): Promise<void> {
    const settings = this.getSettings(cameraId);
    if (!settings || !settings.enabled) {
      return;
    }

    // Skip if detection already in progress
    if (this.detectionInProgress.has(cameraId)) {
      return;
    }

    // Skip if in cooldown period
    const lastMotion = this.lastMotionTimes.get(cameraId) || 0;
    if (Date.now() - lastMotion < settings.motionCooldown) {
      return;
    }

    this.detectionInProgress.add(cameraId);
    const startTime = Date.now();

    try {
      const response = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, frame, {
        headers: {
          'Content-Type': 'image/jpeg'
        },
        timeout: 30000
      });

      const detections = response.data.detections;

      // Calculate event metadata
      const personCount = detections.filter((d: any) => d.class === 'person').length;
      const maxConfidence = Math.max(...detections.map((d: any) => d.confidence), 0);

      // Create detection event
      const event: MotionDetectionEvent = {
        id: `detect_${cameraId}_${Date.now()}`,
        cameraId,
        timestamp: new Date().toISOString(),
        motionLevel: maxConfidence,
        frameCount: 1,
        detectionFrames: [],
        metadata: {
          maxConfidence,
          totalDetections: detections.length,
          personCount,
          processingTime: Date.now() - startTime
        },
        detections: detections.map((d: any) => ({
          class: d.class,
          confidence: d.confidence,
          bbox: d.bbox
        }))
      };

      this.lastMotionTimes.set(cameraId, Date.now());

      // Emit detection event
      this.emit('motionDetected', {
        ...event,
        detectionResolution: { width: 640, height: 360 }
      });

    } catch (error) {
      console.error(`Periodic detection failed for ${cameraId}:`, error);
    } finally {
      this.detectionInProgress.delete(cameraId);
    }
  }

  // Object detection is now handled via HTTP requests to the opencv service

  /**
   * Save motion-detected frame
   */
  private async saveMotionFrame(cameraId: string, frame: Buffer, detections: any[]): Promise<string> {
    // Use unified storage system
    const { getEventPath } = await import('../config/index.js');
    const eventsDir = getEventPath('motion', new Date());

    if (!fs.existsSync(eventsDir)) {
      fs.mkdirSync(eventsDir, { recursive: true });
    }

    const filename = `motion_${cameraId}_${Date.now()}.jpg`;
    const filepath = path.join(eventsDir, filename);

    // Calculate detection metadata
    const personCount = detections.filter(d => d.class === 'person').length;
    const carCount = detections.filter(d => d.class === 'car').length;
    const dogCount = detections.filter(d => d.class === 'dog').length;
    const catCount = detections.filter(d => d.class === 'cat').length;
    const packageCount = detections.filter(d => d.class === 'package').length;
    const maxConfidence = detections.length > 0 ? Math.max(...detections.map(d => d.confidence)) : 0;
    
    // Count unique object classes
    const uniqueClasses = new Set(detections.map(d => d.class));
    const objectCounts: Record<string, number> = {};
    uniqueClasses.forEach(cls => {
      objectCounts[cls] = detections.filter(d => d.class === cls).length;
    });

    // Index the file in the database
    try {
      const { AppDataSource } = await import('../database.js');
      const crypto = await import('node:crypto');
      const fileHash = crypto.createHash('sha256').update(frame).digest('hex');

      const insertQuery = `
        INSERT INTO detection_files (
          file_type,
          camera_id,
          original_filename,
          storage_path,
          file_size,
          file_hash,
          capture_timestamp,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING file_uuid
      `;

      const now = new Date();
      await AppDataSource.query(insertQuery, [
        'event_motion', // file_type
        cameraId, // camera_id
        filename, // original_filename
        filepath, // storage_path
        frame.length, // file_size
        fileHash, // file_hash
        now, // capture_timestamp
        {
          confidence: maxConfidence,
          motionArea: 0, // Will be calculated by other systems
          lightLevel: 50, // Default light level
          hasPersons: personCount > 0,
          hasFaces: false, // Will be updated by face detection
          personCount,
          faceCount: 0,
          knownFaces: 0,
          unknownFaces: 0,
          totalDetections: detections.length,
          uniqueClasses: Array.from(uniqueClasses),
          objectCounts,
          detections: detections.map((d: any) => ({
            class: d.class,
            confidence: d.confidence,
            bbox: d.bbox
          }))
        } // metadata
      ]);

      console.log(`Motion event indexed in database: ${filename} (${frame.length} bytes, ${detections.length} detections)`);
    } catch (dbError) {
      console.error('Error indexing motion event in database:', dbError);
      // Continue execution even if database indexing fails
    }

    return `/events/${filename}`;
  }

  /**
   * Clean up old frame files
   */
  private cleanupOldFrames(framePaths: string[]): void {
    framePaths.forEach(framePath => {
      const fullPath = path.join(__dirname, '../../public', framePath);
      fs.unlink(fullPath, (error) => {
        if (error) console.error('Failed to cleanup frame:', framePath);
      });
    });
  }

  /**
   * Get current status
   */
  getStatus(): {
    camerasInDetection: number;
    queuedFrames: number;
    backgroundFramesStored: number;
  } {
    return {
      camerasInDetection: this.detectionInProgress.size,
      queuedFrames: Array.from(this.motionFrameQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      backgroundFramesStored: this.backgroundFrames.size
    };
  }

  /**
   * Reset camera state (for testing or recovery)
   */
  resetCamera(cameraId: string): void {
    this.detectionInProgress.delete(cameraId);
    this.lastMotionTimes.delete(cameraId);
    this.motionFrameQueue.delete(cameraId);
    this.backgroundFrames.delete(cameraId);
  }
}

// Singleton instance
export const motionTriggeredDetection = new MotionTriggeredDetection();
export default motionTriggeredDetection;