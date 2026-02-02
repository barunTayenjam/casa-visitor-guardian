import { createHash } from 'crypto';
import { RetryService } from '../services/retryService.js';
import { opencvCircuitBreaker } from '../services/circuitBreaker.js';
import redis from 'redis';

export interface DetectionResult {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface FaceDetection {
  id: string;
  name: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface DetectionResponse {
  success: boolean;
  cached: boolean;
  detections?: DetectionResult[];
  faceDetections?: FaceDetection[];
  processingTime?: number;
  fileHash: string;
  error?: string;
}

export interface ObjectDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
  minConfidence?: number;
  maxDetections?: number;
  targetClasses?: string[];
}

export interface FacialRecognitionSettings {
  enabled: boolean;
  minConfidence: number;
  recognitionThreshold?: number;
  minFaceSize?: number;
}

export class ConsolidatedDetectionService {
  private objectDetectionSettings = new Map<string, ObjectDetectionSettings>();
  private facialRecognitionSettings: FacialRecognitionSettings = {
    enabled: true,
    minConfidence: 0.5, // Lower to detect more faces (filter later)
    recognitionThreshold: 0.55 // Slightly lower threshold for better recognition
  };
  private redisCache = new Map<string, { result: DetectionResponse; timestamp: number }>();
  private redisClient: any;
  private redisConnected: boolean = false;
  private readonly CACHE_DURATION = 300000; // 5 minutes
  private initialized = false;
  private connectionAttemptComplete: boolean = false;

  constructor() {
    this.initializeDefaultSettings();
    setInterval(() => this.cleanupCache(), 60000);

    // Initialize Redis client with retry logic
    this.initializeRedisWithRetry();

    // Mark as initialized
    this.initialized = true;
  }

  private async initializeRedisWithRetry(retries = 5, delay = 1000): Promise<void> {
    this.redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379',
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            console.error('Redis: Max reconnection attempts reached, using memory cache only');
            return new Error('Max reconnection attempts');
          }
          return retries * 1000;
        }
      }
    });

    this.redisClient.on('error', (err: any) => {
      // Only log errors after initial connection attempt is complete
      if (this.connectionAttemptComplete) {
        if (this.redisConnected) {
          console.warn('Redis: Connection error, switching to memory cache temporarily');
        }
        this.redisConnected = false;
      }
    });

    this.redisClient.on('connect', () => {
      console.log('Redis: Connected successfully');
      this.redisConnected = true;
    });

    this.redisClient.on('disconnect', () => {
      if (this.connectionAttemptComplete) {
        console.warn('Redis: Disconnected');
      }
      this.redisConnected = false;
    });

    // Retry connection with exponential backoff
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.redisClient.connect();
        this.redisConnected = true;
        console.log('Redis: Connected successfully');
        this.connectionAttemptComplete = true;
        return;
      } catch (err: any) {
        console.error(`Redis: Connection attempt ${attempt}/${retries} failed - ${err.code || err.message}`);
        if (attempt === retries) {
          console.warn('Redis: Could not connect after maximum retries, using memory cache');
          this.connectionAttemptComplete = true;
          return;
        }
        // Exponential backoff: wait longer between retries
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  private initializeDefaultSettings() {
    this.objectDetectionSettings.set('default', { 
      enabled: true, 
      sensitivity: 50, // 0-100 scale
      cooldownPeriod: 1000,
      minConfidence: 0.35, // Lower threshold to detect more objects (filter later)
      maxDetections: 20, // Allow more detections
      targetClasses: ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'dog', 'cat', 'chair', 'couch', 'bed', 'dining table']
    });
  }

  private calculateFileHash(buffer: Buffer): string {
    return createHash('md5').update(buffer).digest('hex');
  }

  private async cleanupCache(): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      // Get all keys in the cache
      for (const [key, value] of this.redisCache) {
        if (now - value.timestamp > this.CACHE_DURATION) {
          keysToDelete.push(key);
        }
      }
      
      // Delete old keys
      for (const key of keysToDelete) {
        this.redisCache.delete(key);
      }
      
      console.log(`Cleaned up ${keysToDelete.length} cache entries`);
    } catch (error) {
      console.error('Error cleaning cache:', error);
    }
  }

  async detectObjects(cameraId: string, imageBuffer: Buffer): Promise<{ detections: DetectionResult[] }> {
    if (!this.objectDetectionSettings.get(cameraId)?.enabled && !this.objectDetectionSettings.get('default')?.enabled) {
      return { detections: [] };
    }

    const fileHash = this.calculateFileHash(imageBuffer);

    // Check Redis cache first (only if connected)
    if (this.redisConnected) {
      try {
        const cachedData = await this.redisClient.get(`detection:${fileHash}`);
        if (cachedData) {
          const data = JSON.parse(cachedData);
          if (Date.now() - data.timestamp < this.CACHE_DURATION) {
            console.log(`ConsolidatedDetectionService: Using Redis cached result for ${fileHash}`);
            return { detections: data.detections || [] };
          }
        }
      } catch (error) {
        console.error('Error checking Redis cache:', error);
      }
    }

    return opencvCircuitBreaker.execute(async () => {
      return RetryService.withRetry(
        async () => {
          const formData = new FormData();
          const uint8Array = new Uint8Array(imageBuffer);
          const blob = new Blob([uint8Array], { type: 'image/jpeg' });
          formData.append('image', blob, 'image.jpg');
          formData.append('fileHash', fileHash);
          formData.append('fileSize', imageBuffer.length.toString());
          formData.append('fileModified', new Date().toISOString());

          const response = await fetch(`${process.env.OPENCV_SERVICE_URL || 'http://localhost:8084'}/detect-objects`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`OpenCV service returned ${response.status}`);
          }

          const data: DetectionResponse = await response.json();

          if (data.success && data.detections) {
            const settings = this.objectDetectionSettings.get(cameraId) || this.objectDetectionSettings.get('default')!;

            const filteredDetections = data.detections.filter(d => {
              const confidenceOK = d.confidence >= (settings.minConfidence || 0.6);
              const classOK = !settings.targetClasses || settings.targetClasses.includes(d.class);
              return confidenceOK && classOK;
            });

             const limitedDetections = filteredDetections.slice(0, settings.maxDetections || 10);

            // Store in Redis cache (only if connected)
            if (this.redisConnected) {
              try {
                await this.redisClient.set(
                  `detection:${fileHash}`,
                  JSON.stringify({
                    result: {
                      ...data,
                      detections: limitedDetections
                    },
                    timestamp: Date.now()
                  }),
                  'EX',
                  this.CACHE_DURATION / 1000
                );
              } catch (error) {
                console.error('Error storing in Redis cache:', error);
              }
            }

            console.log(`ConsolidatedDetectionService: Detected ${limitedDetections.length} objects for camera ${cameraId}`);
            return { detections: limitedDetections };
          }

          return { detections: [] };
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffFactor: 2,
          jitter: true
        },
        `ConsolidatedDetectionService.detectObjects(${cameraId})`
      );
    });
  }

  async detectFaces(cameraId: string, imageBuffer: Buffer): Promise<{ faces: FaceDetection[], knownFaces: FaceDetection[], unknownFaces: FaceDetection[] }> {
    if (!this.facialRecognitionSettings.enabled) {
      return { faces: [], knownFaces: [], unknownFaces: [] };
    }

    const fileHash = this.calculateFileHash(imageBuffer);
    // Check Redis cache first (only if connected)
    if (this.redisConnected) {
      try {
        const cachedData = await this.redisClient.get(`face:${fileHash}`);
        if (cachedData) {
          const data = JSON.parse(cachedData);
          if (Date.now() - data.timestamp < this.CACHE_DURATION) {
            console.log(`ConsolidatedDetectionService: Using Redis cached face result for ${fileHash}`);
            const faces = data.result.faceDetections || [];
            const knownFaces = faces.filter((face: FaceDetection) => face.name !== 'Unknown');
            const unknownFaces = faces.filter((face: FaceDetection) => face.name === 'Unknown');
            return { faces, knownFaces, unknownFaces };
          }
        }
      } catch (error) {
        console.error('Error checking Redis cache for faces:', error);
      }
    }

    return opencvCircuitBreaker.execute(async () => {
      return RetryService.withRetry(
        async () => {
          const formData = new FormData();
          const uint8Array = new Uint8Array(imageBuffer);
          const blob = new Blob([uint8Array], { type: 'image/jpeg' });
          formData.append('image', blob, 'image.jpg');
          formData.append('fileHash', fileHash);
          formData.append('fileSize', imageBuffer.length.toString());
          formData.append('fileModified', new Date().toISOString());

          const response = await fetch(`${process.env.OPENCV_SERVICE_URL || 'http://localhost:8084'}/recognize-faces`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`OpenCV service returned ${response.status}`);
          }

          const data: DetectionResponse = await response.json();

          if (data.success && data.faceDetections) {
            const faces = data.faceDetections.map((face: any) => ({
              id: face.id || 'unknown',
              name: face.name || 'Unknown',
              confidence: face.confidence || 0,
              bbox: face.bbox
            }));

            const knownFaces = faces.filter((face: FaceDetection) => face.name !== 'Unknown');
            const unknownFaces = faces.filter((face: FaceDetection) => face.name === 'Unknown');

            // Store in Redis cache (only if connected)
            if (this.redisConnected) {
              try {
                await this.redisClient.set(
                  `face:${fileHash}`,
                  JSON.stringify({
                    result: {
                      ...data,
                      faceDetections: faces
                    },
                    timestamp: Date.now()
                  }),
                  'EX',
                  this.CACHE_DURATION / 1000
                );
              } catch (error) {
                console.error('Error storing face data in Redis cache:', error);
              }
            }

            return { faces, knownFaces, unknownFaces };
          }

          return { faces: [], knownFaces: [], unknownFaces: [] };
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffFactor: 2,
          jitter: true
        },
        `ConsolidatedDetectionService.detectFaces(${cameraId})`
      );
    });
  }

  updateObjectDetectionSettings(cameraId: string, settings: Partial<ObjectDetectionSettings>): boolean {
    const current = this.objectDetectionSettings.get(cameraId) || this.objectDetectionSettings.get('default')!;
    this.objectDetectionSettings.set(cameraId, { ...current, ...settings });
    return true;
  }

  getObjectDetectionSettings(cameraId: string): ObjectDetectionSettings | null {
    return this.objectDetectionSettings.get(cameraId) || this.objectDetectionSettings.get('default') || null;
  }

  updateFacialRecognitionSettings(settings: Partial<FacialRecognitionSettings>): boolean {
    this.facialRecognitionSettings = { ...this.facialRecognitionSettings, ...settings };
    return true;
  }

  getFacialRecognitionSettings(): FacialRecognitionSettings {
    return this.facialRecognitionSettings;
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    try {
      // Cleanup Redis client
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('Redis client disconnected');
      }
      
      // Cleanup any other resources
      console.log('Consolidated detection service resources cleaned up');
    } catch (error) {
      console.error('Error cleaning consolidated detection service resources:', error);
    }
  }

  /**
   * Cleanup hook for graceful shutdown
   */
  async cleanupHook(): Promise<void> {
    console.log('Consolidated detection service cleanup hook triggered');
    await this.cleanup();
  }

  async getServiceStatus(): Promise<{ available: boolean; url: string; responseTime?: number }> {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${process.env.OPENCV_SERVICE_URL || 'http://localhost:8084'}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      return {
        available: response.ok,
        url: process.env.OPENCV_SERVICE_URL || 'http://localhost:8084',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        available: false,
        url: process.env.OPENCV_SERVICE_URL || 'http://localhost:8084'
      };
    }
  }
}

export const consolidatedDetectionService = new ConsolidatedDetectionService();
export function getConsolidatedDetectionService(): ConsolidatedDetectionService {
  return consolidatedDetectionService;
}
export default consolidatedDetectionService;