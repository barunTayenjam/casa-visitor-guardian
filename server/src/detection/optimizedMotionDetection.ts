import { Server as SocketIOServer } from 'socket.io';
import { StreamManager } from '../streams/rtspManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { ObjectDetectionService, DetectionResult } from './objectDetectionOpenCV.js';
import { FacialRecognitionService, FaceDetection } from './facialRecognition.js';
import { AppDataSource } from '../database.js';
import { Event } from '../models/Event.js';

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
  private detectionInterval: NodeJS.Timeout | null = null;
  private cameraSettings = new Map<string, OptimizedMotionSettings>();
  private lastEventTimes = new Map<string, number>();
  private eventCounts = new Map<string, number>(); // Per hour
  private frameBuffer = new Map<string, Buffer[]>();
  private workers: Worker[] = [];
  private metrics: PerformanceMetrics;
  private isOptimized = false;

  constructor(streamManager: StreamManager, io: SocketIOServer) {
    super();
    this.streamManager = streamManager;
    this.io = io;
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
        quietHours: { start: '22:00', end: '06:00' } // Reduce alerts at night
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
  }> {
    const result = {
      hasPersons: false,
      hasFaces: false,
      personCount: 0,
      faceCount: 0,
      knownFaces: 0,
      unknownFaces: 0,
      persons: [] as DetectionResult[],
      faces: [] as FaceDetection[]
    };

    try {
      // Get detection services from global scope
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const objectDetectionService = (global as any).objectDetectionService as ObjectDetectionService;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const facialRecognitionService = (global as any).facialRecognitionService as FacialRecognitionService;
      
      // Run person detection if available
      if (objectDetectionService) {
        try {
          const personResult = await objectDetectionService.detectObjects(cameraId, frame);
          
          if (personResult && personResult.detections) {
            const persons = personResult.detections.filter((d: DetectionResult) => d.class === 'person');
            if (persons.length > 0) {
              result.hasPersons = true;
              result.personCount = persons.length;
              result.persons = persons;
            }
          }
        } catch (error) {
          console.warn(`Person detection failed for ${cameraId}:`, error);
        }
      }
      
      // Run face detection if available
      if (facialRecognitionService) {
        try {
          const faceResult = await facialRecognitionService.recognizeFaces(cameraId, frame);
          
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
      const eventsDir = '/app/public/events';
      
      // Ensure directory exists
      if (!fs.existsSync(eventsDir)) {
        fs.mkdirSync(eventsDir, { recursive: true });
      }
      
      const filepath = path.join(eventsDir, filename);

      // Async file write
      fs.writeFile(filepath, frame, (error) => {
        if (error) {
          reject(error);
          return;
        }

        const event: OptimizedMotionEvent = {
          id: `evt_${filename}`,
          cameraId,
          timestamp: new Date().toISOString(),
          imagePath: `/events/${filename}`,
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
        
        // Skip database save to avoid TypeORM issues - file-based storage is sufficient
        // The events are stored in the filesystem and accessed via the API endpoints
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

  // Cleanup old frames and optimize memory
  cleanup(): void {
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
}

// Factory function
export function setupOptimizedMotionDetection(
  streamManager: StreamManager, 
  io: SocketIOServer
): OptimizedMotionDetector {
  const detector = new OptimizedMotionDetector(streamManager, io);
  detector.start();
  
  // Setup periodic cleanup
  setInterval(() => detector.cleanup(), 300000); // Every 5 minutes
  
    // Make available globally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).optimizedMotionDetector = detector;
  
  return detector;
}

export default OptimizedMotionDetector;
