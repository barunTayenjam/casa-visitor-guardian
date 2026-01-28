import { Server as SocketIOServer } from 'socket.io';
import { StreamManager } from '../streams/rtspManager.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'node:events';
import { consolidatedDetectionService, DetectionResult, FaceDetection } from './consolidatedDetectionService.js';
import { AppDataSource } from '../database.js';
import { Event } from '../models/Event.js';
import { getDetectionsPath, getEventPath } from '../config/index.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optimized motion detection settings
interface OptimizedMotionSettings {
  enabled: boolean;
  sensitivity: number; // 0-100
  cooldownPeriod: number; // ms
  detectionInterval: number; // ms - ADAPTIVE
  minConfidence: number; // 0-100
  maxEventsPerHour: number;
  adaptiveMode: boolean; // Enable adaptive detection
  nightModeSensitivity: number; // Different sensitivity for night
  quietHours: { start: string; end: string }; // Reduce detection during quiet hours
  
  // NEW: Automatic detection settings
  autoDetectObjects: boolean;      // Automatically run object detection
  autoDetectFaces: boolean;        // Automatically run face detection
  detectionPriority: 'immediate' | 'deferred'; // When to run detection
}

// Motion event with enhanced metadata
interface OptimizedMotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  frameSize: number;
  detectionTime: number;
  metadata: {
    lightLevel?: number;
    motionArea?: number;
    objectCount?: number;
    // Enhanced detection metadata
    hasPersons?: boolean;
    hasFaces?: boolean;
    personCount?: number;
    faceCount?: number;
    knownFaces?: number;
    unknownFaces?: number;
  };
}

// Performance metrics
interface PerformanceMetrics {
  totalDetections: number;
  falsePositives: number;
    averageProcessingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  lastOptimization: string;
}

interface PersonDetectedEvent {
  cameraId: string;
  timestamp: string;
  persons: DetectionResult[];
  imagePath: string;
}

interface FaceDetectedEvent {
  cameraId: string;
  timestamp: string;
  faces: FaceDetection[];
  imagePath: string;
}

export class OptimizedMotionDetector extends EventEmitter {
  private streamManager: StreamManager;
  private io: SocketIOServer;
  private detectionService: any;
  private detectionInterval: NodeJS.Timeout | null = null;
  private cameraSettings = new Map<string, OptimizedMotionSettings>();
  private lastEventTimes = new Map<string, number>();
  private eventCounts = new Map<string, number>(); // Per hour
  private frameBuffer = new Map<string, Buffer[]>();
  private workers: Worker[] = [];
  private metrics: PerformanceMetrics;
  private isOptimized = false;
  private initialized = false;

  constructor(streamManager: StreamManager, io: SocketIOServer, detectionService?: any) {
    super();
    this.streamManager = streamManager;
    this.io = io;
    this.detectionService = detectionService;
    this.metrics = {
      totalDetections: 0,
      falsePositives: 0,
      averageProcessingTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastOptimization: new Date().toISOString()
    };

    this.initializeDefaultSettings();
    this.setupPerformanceMonitoring();
    this.initialized = true;
  }

  // Initialize optimized default settings
  private initializeDefaultSettings(): void {
    this.streamManager.getAllCameras().forEach(camera => {
      this.cameraSettings.set(camera.id, {
        enabled: true,
        sensitivity: 30,
        cooldownPeriod: 30000, // 30 seconds (was 10)
        detectionInterval: 2000, // 2 seconds (was 500ms)
        minConfidence: 60, // Minimum confidence to trigger
        maxEventsPerHour: 50, // Rate limiting
        adaptiveMode: true,
        nightModeSensitivity: 50, // Higher sensitivity at night
        quietHours: { start: '22:00', end: '06:00' }, // Reduce alerts at night
        autoDetectObjects: true,      // Automatically run object detection
        autoDetectFaces: true,        // Automatically run face detection
        detectionPriority: 'immediate' // When to run detection
      });
    });
  }

  // Setup performance monitoring
  private setupPerformanceMonitoring(): void {
    setInterval(() => {
      this.updateMetrics();
      this.optimizePerformance();
    }, 60000); // Every minute
  }

  // Update performance metrics
  private updateMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    
    // Reset hourly counters
    const now = new Date();
    if (now.getMinutes() === 0) {
      this.eventCounts.clear();
    }
  }

  // Adaptive performance optimization
  private optimizePerformance(): void {
    const memUsage = this.metrics.memoryUsage;
    
    // If memory usage is high, reduce detection frequency
    if (memUsage > 500) { // 500MB
      this.cameraSettings.forEach((settings, cameraId) => {
        if (settings.adaptiveMode && settings.detectionInterval < 5000) {
          settings.detectionInterval = Math.min(5000, settings.detectionInterval * 1.5);
          console.log(`Reduced detection frequency for ${cameraId} to ${settings.detectionInterval}ms due to high memory usage`);
        }
      });
    }
    
    // If memory is low and we have active cameras, can increase frequency
    if (memUsage < 200 && this.metrics.totalDetections < 10) {
      this.cameraSettings.forEach((settings, cameraId) => {
        if (settings.adaptiveMode && settings.detectionInterval > 1000) {
          settings.detectionInterval = Math.max(1000, settings.detectionInterval * 0.8);
          console.log(`Increased detection frequency for ${cameraId} to ${settings.detectionInterval}ms`);
        }
      });
    }
    
    this.metrics.lastOptimization = new Date().toISOString();
  }

  // Check if current time is in quiet hours
  private isQuietHours(settings: OptimizedMotionSettings): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    if (settings.quietHours.start <= settings.quietHours.end) {
      return currentTime >= settings.quietHours.start && currentTime <= settings.quietHours.end;
    } else {
      // Overnight (e.g., 22:00 to 06:00)
      return currentTime >= settings.quietHours.start || currentTime <= settings.quietHours.end;
    }
  }

  // Get adaptive detection interval
  private getAdaptiveInterval(cameraId: string): number {
    const settings = this.cameraSettings.get(cameraId);
    if (!settings || !settings.adaptiveMode) {
      return settings?.detectionInterval || 2000;
    }

    let interval = settings.detectionInterval;

    // Adjust for quiet hours
    if (this.isQuietHours(settings)) {
      interval *= 2; // Double the interval during quiet hours
    }

    // Adjust based on recent activity
    const lastEvent = this.lastEventTimes.get(cameraId) || 0;
    const timeSinceLastEvent = Date.now() - lastEvent;
    
    if (timeSinceLastEvent > 300000) { // 5 minutes no activity
      interval *= 1.5; // Reduce frequency
    } else if (timeSinceLastEvent < 60000) { // Recent activity
      interval = Math.max(1000, interval * 0.8); // Increase frequency
    }

    return Math.round(interval);
  }

  // Start optimized motion detection
  start(): void {
    if (this.detectionInterval) {
      return;
    }

    // Use adaptive scheduling instead of fixed interval
    const scheduleNextDetection = () => {
      this.detectMotionOnAllCameras().then(() => {
        // Calculate next interval based on camera settings
        const nextInterval = Math.min(
          ...Array.from(this.cameraSettings.keys()).map(id => this.getAdaptiveInterval(id))
        );
        
        this.detectionInterval = setTimeout(scheduleNextDetection, nextInterval);
      });
    };

    scheduleNextDetection();
    console.log('Optimized motion detection started with adaptive scheduling');
  }

  // Stop motion detection
  stop(): void {
    if (this.detectionInterval) {
      clearTimeout(this.detectionInterval);
      this.detectionInterval = null;
      console.log('Optimized motion detection stopped');
    }
    
    // Cleanup workers
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
  }

  // Optimized motion detection for all cameras
  private async detectMotionOnAllCameras(): Promise<void> {
    const startTime = Date.now();
    const cameras = this.streamManager.getAllCameras();
    
    // Process cameras in parallel with limited concurrency
    const batchSize = 3; // Process max 3 cameras simultaneously
    for (let i = 0; i < cameras.length; i += batchSize) {
      const batch = cameras.slice(i, i + batchSize);
      await Promise.all(
        batch.map(camera => this.detectMotionOnCamera(camera.id))
      );
    }
    
    // Update metrics
    const processingTime = Date.now() - startTime;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime + processingTime) / 2;
  }

  // Optimized motion detection for single camera
  private async detectMotionOnCamera(cameraId: string): Promise<void> {
    const settings = this.cameraSettings.get(cameraId);
    if (!settings || !settings.enabled) {
      return;
    }

    // Rate limiting check
    const now = Date.now();
    const lastEvent = this.lastEventTimes.get(cameraId) || 0;
    if (now - lastEvent < settings.cooldownPeriod) {
      return;
    }

    // Hourly event limit check
    const hourKey = `${cameraId}_${new Date().getHours()}`;
    const eventCount = this.eventCounts.get(hourKey) || 0;
    if (eventCount >= settings.maxEventsPerHour) {
      return;
    }

    // Get current frame
    const currentFrame = this.streamManager.getLastFrame(cameraId);
    if (!currentFrame || currentFrame.length === 0) {
      return;
    }

    // Add to frame buffer for smoothing
    if (!this.frameBuffer.has(cameraId)) {
      this.frameBuffer.set(cameraId, []);
    }
    
    const buffer = this.frameBuffer.get(cameraId)!;
    buffer.push(currentFrame);
    
    // Keep only last 3 frames for comparison
    if (buffer.length > 3) {
      buffer.shift();
    }

    // Need at least 2 frames for comparison
    if (buffer.length < 2) {
      return;
    }

    try {
      // Use worker thread for CPU-intensive comparison
      const motionDetected = await this.compareFramesAsync(
        buffer[buffer.length - 2],
        buffer[buffer.length - 1],
        settings.sensitivity
      );

      if (motionDetected.confidence > settings.minConfidence) {
        await this.handleMotionDetected(cameraId, currentFrame, motionDetected);
      }
    } catch (error) {
      console.error(`Error in motion detection for ${cameraId}:`, error);
    }
  }

  // Asynchronous frame comparison using worker thread
  private async compareFramesAsync(
    frame1: Buffer, 
    frame2: Buffer, 
    sensitivity: number
  ): Promise<{ confidence: number; motionArea: number }> {
    return new Promise((resolve, reject) => {
      // For now, use simple synchronous comparison
      // In production, this would use a worker thread
      try {
        const sizeDiff = Math.abs(frame2.length - frame1.length);
        const confidence = Math.min(100, Math.round((sizeDiff / 10000) * 100));
        const motionArea = Math.round(sizeDiff / 1000); // Estimated area
        
        resolve({ confidence, motionArea });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Handle motion detection with enhanced person/face analysis
  private async handleMotionDetected(
    cameraId: string, 
    frame: Buffer, 
    motionData: { confidence: number; motionArea: number }
  ): Promise<void> {
    const now = Date.now();
    
    // Update tracking
    this.lastEventTimes.set(cameraId, now);
    const hourKey = `${cameraId}_${new Date().getHours()}`;
    this.eventCounts.set(hourKey, (this.eventCounts.get(hourKey) || 0) + 1);
    this.metrics.totalDetections++;

    try {
      // Enhanced motion analysis with person and face detection
      const analysisResult = await this.performEnhancedAnalysis(cameraId, frame);
      
      // Async file writing to avoid blocking
      this.saveMotionFrameAsync(cameraId, frame, motionData, analysisResult)
        .then(event => {
          if (event) {
            // Emit regular motion event
            this.io.emit('motionDetected', event);
            this.emit('motionDetected', event);
            
            // Emit enhanced motion event if person/face detected
            if (analysisResult.hasPersons || analysisResult.hasFaces) {
              this.io.emit('enhancedMotionDetected', {
                cameraId,
                timestamp: event.timestamp,
                hasPersons: analysisResult.hasPersons,
                hasFaces: analysisResult.hasFaces,
                personCount: analysisResult.personCount,
                faceCount: analysisResult.faceCount,
                knownFaces: analysisResult.knownFaces,
                unknownFaces: analysisResult.unknownFaces,
                analysis: analysisResult,
                motionEvent: event
              });
            }
            
            // Emit specific person/face detection events
            if (analysisResult.persons && analysisResult.persons.length > 0) {
              const personDetectedEvent: PersonDetectedEvent = {
                cameraId,
                timestamp: event.timestamp,
                persons: analysisResult.persons,
                imagePath: event.imagePath
              };
              this.io.emit('personDetected', personDetectedEvent);

              // Emit timeline event for tracked objects
              this.emitTimelineEvents(cameraId, analysisResult.persons, 'person', event.timestamp);
            }

            if (analysisResult.faces && analysisResult.faces.length > 0) {
              const faceDetectedEvent: FaceDetectedEvent = {
                cameraId,
                timestamp: event.timestamp,
                faces: analysisResult.faces,
                imagePath: event.imagePath
              };
              this.io.emit('faceDetected', faceDetectedEvent);
            }
          }
        })
        .catch(error => {
          console.error(`Failed to save motion frame for ${cameraId}:`, error);
          this.metrics.falsePositives++;
        });
    } catch (error) {
      console.error(`Enhanced analysis failed for ${cameraId}:`, error);
      // Fallback to basic motion detection
      this.saveMotionFrameAsync(cameraId, frame, motionData)
        .then(event => {
          if (event) {
            this.io.emit('motionDetected', event);
            this.emit('motionDetected', event);
          }
        });
    }
  }

  // Perform enhanced analysis with person and face detection
  private async performEnhancedAnalysis(cameraId: string, frame: Buffer): Promise<{
    hasPersons: boolean;
    hasFaces: boolean;
    personCount: number;
    faceCount: number;
    knownFaces: number;
    unknownFaces: number;
    persons: DetectionResult[];
    faces: FaceDetection[];
    allDetections: DetectionResult[];
  }> {
    const result = {
      hasPersons: false,
      hasFaces: false,
      personCount: 0,
      faceCount: 0,
      knownFaces: 0,
      unknownFaces: 0,
      persons: [] as DetectionResult[],
      faces: [] as FaceDetection[],
      allDetections: [] as DetectionResult[]
    };

    try {
      // Use the detection service if available
      if (this.detectionService) {
        // Run object detection
        try {
          const objectResult = await this.detectionService.detectObjects(cameraId, frame);
          
          if (objectResult && objectResult.detections) {
            const persons = objectResult.detections.filter((d: DetectionResult) => d.class === 'person');
            if (persons.length > 0) {
              result.hasPersons = true;
              result.personCount = persons.length;
              result.persons = objectResult.detections;
              result.allDetections = objectResult.detections;
            }
          }
        } catch (error) {
          console.warn(`Object detection failed for ${cameraId}:`, error);
        }
        
        // Run face detection
        try {
          const faceResult = await this.detectionService.detectFaces(cameraId, frame);
          
          if (faceResult && faceResult.faces) {
            if (faceResult.faces.length > 0) {
              result.hasFaces = true;
              result.faceCount = faceResult.faces.length;
              result.faces = faceResult.faces;
              result.knownFaces = faceResult.knownFaces.length;
              result.unknownFaces = faceResult.unknownFaces.length;
            }
          }
        } catch (error) {
          console.warn(`Face detection failed for ${cameraId}:`, error);
        }
      } else {
        // Fallback to global services if detection service not available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const objectDetectionService = consolidatedDetectionService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const facialRecognitionService = consolidatedDetectionService;
        
        // Run object detection if available
        if (objectDetectionService) {
          try {
            const objectResult = await objectDetectionService.detectObjects(cameraId, frame);
            
            if (objectResult && objectResult.detections) {
              const persons = objectResult.detections.filter((d: DetectionResult) => d.class === 'person');
              if (persons.length > 0) {
                result.hasPersons = true;
                result.personCount = persons.length;
                result.persons = objectResult.detections;
                result.allDetections = objectResult.detections;
              }
            }
          } catch (error) {
            console.warn(`Object detection failed for ${cameraId}:`, error);
          }
        }
        
        // Run face detection if available
        if (facialRecognitionService) {
          try {
            const faceResult = await consolidatedDetectionService.detectFaces(cameraId, frame);
            
            if (faceResult && faceResult.faces) {
              if (faceResult.faces.length > 0) {
                result.hasFaces = true;
                result.faceCount = faceResult.faces.length;
                result.faces = faceResult.faces;
                result.knownFaces = faceResult.knownFaces.length;
                result.unknownFaces = faceResult.unknownFaces.length;
              }
            }
          } catch (error) {
            console.warn(`Face detection failed for ${cameraId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Enhanced analysis error for ${cameraId}:`, error);
    }

    return result;
  }

  // Asynchronous frame saving with enhanced metadata
  private async saveMotionFrameAsync(
    cameraId: string, 
    frame: Buffer, 
    motionData: { confidence: number; motionArea: number },
    analysisResult?: Awaited<ReturnType<typeof this.performEnhancedAnalysis>>
  ): Promise<OptimizedMotionEvent | null> {
    return new Promise((resolve, reject) => {
      // Validate frame
      if (!frame || frame.length === 0 || frame[0] !== 0xFF || frame[1] !== 0xD8) {
        reject(new Error('Invalid frame data'));
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `motion_${cameraId}_${timestamp}.jpg`;

      // Use unified storage system with proper subdirectory
      const eventsDir = getEventPath('motion', new Date());

      // Ensure directory exists
      if (!fs.existsSync(eventsDir)) {
        fs.mkdirSync(eventsDir, { recursive: true });
      }

      const filepath = path.join(eventsDir, filename);

      // Validate frame is complete JPEG
      const MIN_FRAME_SIZE = 5000; // Minimum 5KB for valid JPEG
      const JPEG_START = [0xFF, 0xD8];
      const JPEG_END = [0xFF, 0xD9];

      if (!frame || frame.length < MIN_FRAME_SIZE) {
        console.warn(`[${cameraId}] Rejected invalid frame size: ${frame?.length || 0} bytes (minimum ${MIN_FRAME_SIZE} bytes)`);
        reject(new Error(`Invalid frame size: ${frame?.length || 0} bytes (minimum ${MIN_FRAME_SIZE} bytes)`));
        return;
      }

      if (frame[0] !== JPEG_START[0] || frame[1] !== JPEG_START[1]) {
        console.warn(`[${cameraId}] Rejected frame with invalid JPEG start marker`);
        reject(new Error('Invalid JPEG start marker'));
        return;
      }

      if (frame[frame.length - 2] !== JPEG_END[0] || frame[frame.length - 1] !== JPEG_END[1]) {
        console.warn(`[${cameraId}] Rejected incomplete frame (missing JPEG end marker) - size: ${frame.length} bytes`);
        reject(new Error('Invalid JPEG end marker - incomplete frame'));
        return;
      }

      // Async file write
      fs.writeFile(filepath, frame, async (error) => {
        if (error) {
          reject(error);
          return;
        }

        // Calculate file hash for integrity
        const crypto = await import('node:crypto');
        const fileHash = crypto.createHash('sha256').update(frame).digest('hex');

        // Save to events table with detection data
        try {
          const now = new Date();
          const event = new Event();
          event.event_type = 'motion';
          event.file_path = filepath; // Keep original path for internal reference
          event.camera_id = cameraId;
          event.timestamp = now;
          event.confidence = motionData.confidence / 100; // Convert to 0-1 range
          event.metadata = JSON.stringify({
            confidence: motionData.confidence,
            motionArea: motionData.motionArea,
            lightLevel: this.estimateLightLevel(frame),
            hasPersons: analysisResult?.hasPersons || false,
            hasFaces: analysisResult?.hasFaces || false
          });

          // Detection metadata
          event.persons_detected = analysisResult?.personCount || 0;
          event.faces_detected = analysisResult?.faceCount || 0;
          event.known_faces_count = analysisResult?.knownFaces || 0;
          event.unknown_faces_count = analysisResult?.unknownFaces || 0;

          // Save detection data as JSONB
          event.object_detections = analysisResult?.persons || [];
          event.face_detections = analysisResult?.faces || [];
          event.created_at = now;

          await AppDataSource.getRepository(Event).save(event);

          console.log(`Motion event saved to events table: ${filename} (${frame.length} bytes, ${motionData.confidence}% confidence)`);
        } catch (dbError) {
          console.error('Error saving motion event to events table:', dbError);
          // Continue execution even if database save fails
        }

        // Also index in detection_files table for backward compatibility
        try {
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
          const allDetections = analysisResult?.allDetections || [];
          const uniqueClasses = new Set(allDetections.map((d: any) => d.class));
          const objectCounts: Record<string, number> = {};
          uniqueClasses.forEach((cls: string) => {
            objectCounts[cls] = allDetections.filter((d: any) => d.class === cls).length;
          });

          const result = await AppDataSource.query(insertQuery, [
            'event_motion', // file_type
            cameraId, // camera_id
            filename, // original_filename
            filepath, // storage_path
            frame.length, // file_size
            fileHash, // file_hash
            now, // capture_timestamp
            {
              confidence: motionData.confidence,
              motionArea: motionData.motionArea,
              lightLevel: this.estimateLightLevel(frame),
              hasPersons: analysisResult?.hasPersons || false,
              hasFaces: analysisResult?.hasFaces || false,
              personCount: analysisResult?.personCount || 0,
              faceCount: analysisResult?.faceCount || 0,
              knownFaces: analysisResult?.knownFaces || 0,
              unknownFaces: analysisResult?.unknownFaces || 0,
              totalDetections: allDetections.length,
              uniqueClasses: Array.from(uniqueClasses),
              objectCounts,
              detections: allDetections.map((d: any) => ({
                class: d.class,
                confidence: d.confidence,
                bbox: d.bbox
              }))
            } // metadata
          ]);

          console.log(`Motion event indexed in database: ${filename} (${frame.length} bytes, ${allDetections.length} detections)`);
        } catch (dbError) {
          console.error('Error indexing motion event in database:', dbError);
          // Continue execution even if database indexing fails
        }

        const event: OptimizedMotionEvent = {
          id: `evt_${filename}`,
          cameraId,
          timestamp: new Date().toISOString(),
          imagePath: `/events/${filename}`, // Updated to use correct path format for frontend
          confidence: motionData.confidence,
          duration: 0,
          frameSize: frame.length,
          detectionTime: Date.now(),
          metadata: {
            motionArea: motionData.motionArea,
            lightLevel: this.estimateLightLevel(frame),
            // Enhanced detection metadata
            hasPersons: analysisResult?.hasPersons || false,
            hasFaces: analysisResult?.hasFaces || false,
            personCount: analysisResult?.personCount || 0,
            faceCount: analysisResult?.faceCount || 0,
            knownFaces: analysisResult?.knownFaces || 0,
            unknownFaces: analysisResult?.unknownFaces || 0
          }
        };

        console.log(`Motion event saved to filesystem: ${filename} (${frame.length} bytes, ${motionData.confidence}% confidence)`);

        // Optimize: Only log motion events in development or high confidence events
        if (process.env.NODE_ENV !== 'production' || motionData.confidence > 80) {
          console.log(`Motion event saved: ${filename} (${frame.length} bytes, ${motionData.confidence}% confidence)`);
        }
        resolve(event);
      });
    });
  }

  // Estimate light level from frame (simple brightness calculation)
  private estimateLightLevel(frame: Buffer): number {
    if (frame.length < 1000) return 50; // Default for small frames
    
    // Sample a few bytes from the image data (very rough estimate)
    let totalBrightness = 0;
    const sampleSize = Math.min(100, frame.length / 10);
    
    for (let i = 0; i < sampleSize; i++) {
      const sampleIndex = Math.floor(Math.random() * (frame.length - 100)) + 50;
      totalBrightness += frame[sampleIndex];
    }
    
    return Math.round((totalBrightness / sampleSize / 255) * 100);
  }

  // Get performance metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Update camera settings
  updateSettings(cameraId: string, settings: Partial<OptimizedMotionSettings>): boolean {
    const currentSettings = this.cameraSettings.get(cameraId);
    if (!currentSettings) {
      return false;
    }

    Object.assign(currentSettings, settings);
    return true;
  }

  // Get camera settings
  getSettings(cameraId: string): OptimizedMotionSettings | null {
    return this.cameraSettings.get(cameraId) || null;
  }

  // Cleanup all resources
  async cleanup(): Promise<void> {
    try {
      // Stop detection
      this.stop();
      
      // Clear frame buffers
      this.frameBuffer.clear();
      
      // Terminate workers
      this.workers.forEach(worker => worker.terminate());
      this.workers = [];
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      console.log('Optimized motion detection resources cleaned up');
    } catch (error) {
      console.error('Error cleaning optimized motion detection resources:', error);
    }
  }

  // Cleanup old frames and optimize memory
  cleanupMemory(): void {
    // Clear old frame buffers
    this.frameBuffer.forEach((buffer, cameraId) => {
      if (buffer.length > 3) {
        this.frameBuffer.set(cameraId, buffer.slice(-3));
      }
    });

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  // Emit timeline events for detected objects
  private async emitTimelineEvents(
    cameraId: string,
    detections: DetectionResult[],
    source: string,
    timestamp: string
  ): Promise<void> {
    const timelineService = (global as any).timelineService;
    if (!timelineService) return;

    for (const detection of detections) {
      const objectId = `obj_${cameraId}_${detection.class}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      try {
        await timelineService.addTimelineEvent({
          camera: cameraId,
          source,
          sourceId: objectId,
          classType: detection.class,
          timestamp: new Date(timestamp),
          data: {
            object_id: objectId,
            label: detection.class,
            score: detection.confidence,
            box: detection.bbox,
          },
        });
      } catch (error) {
        console.error('Error emitting timeline event:', error);
      }
    }

    // Trigger review segment generation
    const reviewService = (global as any).reviewService;
    if (reviewService) {
      reviewService.generateReviewSegments(cameraId).catch(err => {
        console.error('Error generating review segments:', err);
      });
    }
  }
}

// Factory function
export function setupOptimizedMotionDetection(
  streamManager: StreamManager, 
  io: SocketIOServer,
  detectionService?: any
): OptimizedMotionDetector {
  const detector = new OptimizedMotionDetector(streamManager, io);
  detector.start();
  
  // Setup periodic cleanup
  setInterval(() => detector.cleanupMemory(), 300000); // Every 5 minutes
  
    // Make available globally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).optimizedMotionDetector = detector;
  
  return detector;
}

// Cleanup function for graceful shutdown
export async function cleanupOptimizedMotionDetection(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detector = (global as any).optimizedMotionDetector as OptimizedMotionDetector;
  if (detector) {
    await detector.cleanup();
  }
}

export default OptimizedMotionDetector;
