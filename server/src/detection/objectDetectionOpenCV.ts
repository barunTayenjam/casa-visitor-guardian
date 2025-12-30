import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

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

export interface ObjectDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
  minConfidence?: number;
  maxDetections?: number;
  targetClasses?: string[];
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

export class ObjectDetectionService {
  private settings = new Map<string, ObjectDetectionSettings>();
  private openCVServiceUrl: string;
  private cache = new Map<string, { result: DetectionResponse; timestamp: number }>();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  constructor() {
    this.openCVServiceUrl = process.env.OPENCV_SERVICE_URL || 'http://localhost:8084';
    console.log(`ObjectDetectionService: Initialized with OpenCV service at ${this.openCVServiceUrl}`);
    this.initializeDefaultSettings();
    
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000);
  }
  
  private initializeDefaultSettings() {
    this.settings.set('default', { 
      enabled: true, 
      sensitivity: 0.5, 
      cooldownPeriod: 1000,
      minConfidence: 0.6,
      maxDetections: 10,
      targetClasses: ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle']
    });
  }
  
  isReady(): boolean {
    return this.openCVServiceUrl !== null;
  }
  
  private calculateFileHash(buffer: Buffer): string {
    return createHash('md5').update(buffer).digest('hex');
  }

  private cleanupCache(): void {
    const now = Date.now();
    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    });
  }

  async detectObjects(cameraId: string, imageBuffer: Buffer): Promise<{ detections: DetectionResult[] }> {
    if (!this.settings.get(cameraId)?.enabled && !this.settings.get('default')?.enabled) {
      return { detections: [] };
    }

    const fileHash = this.calculateFileHash(imageBuffer);

    // Check cache first
    const cached = this.cache.get(fileHash);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`ObjectDetectionService: Using cached result for ${fileHash}`);
      return { detections: cached.result.detections || [] };
    }

    // Save image temporarily to shared location accessible by both containers
    const tempDir = path.join('/app/public/events/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `detect_${fileHash}.jpg`);
    fs.writeFileSync(tempFilePath, imageBuffer);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.openCVServiceUrl}/detect-objects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imagePath: tempFilePath,
          fileHash,
          fileSize: imageBuffer.length,
          fileModified: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      if (!response.ok) {
        throw new Error(`OpenCV service returned ${response.status}`);
      }

      const data: DetectionResponse = await response.json();

      if (data.success && data.detections) {
        const settings = this.settings.get(cameraId) || this.settings.get('default')!;

        // Filter by target classes and confidence
        const filteredDetections = data.detections.filter(d => {
          const confidenceOK = d.confidence >= (settings.minConfidence || 0.6);
          const classOK = !settings.targetClasses || settings.targetClasses.includes(d.class);
          return confidenceOK && classOK;
        });

        // Limit number of detections
        const limitedDetections = filteredDetections.slice(0, settings.maxDetections || 10);

        // Cache the result
        this.cache.set(fileHash, {
          result: {
            ...data,
            detections: limitedDetections
          },
          timestamp: Date.now()
        });

        console.log(`ObjectDetectionService: Detected ${limitedDetections.length} objects for camera ${cameraId}`);
        return { detections: limitedDetections };
      }

      return { detections: [] };
    } catch (error: any) {
      console.error(`ObjectDetectionService: Detection failed for camera ${cameraId}:`, error.message);
      
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      return { detections: [] };
    }
  }
  
  async detectPersons(cameraId: string, imageBuffer: Buffer): Promise<{ detections: DetectionResult[] }> {
    const result = await this.detectObjects(cameraId, imageBuffer);
    const persons = result.detections.filter(d => d.class === 'person');
    return { detections: persons };
  }
  
  updateSettings(cameraId: string, settings: Partial<ObjectDetectionSettings>): boolean {
    const current = this.settings.get(cameraId) || this.settings.get('default')!;
    this.settings.set(cameraId, { ...current, ...settings });
    return true;
  }
  
  getSettings(cameraId: string): ObjectDetectionSettings | null {
    return this.settings.get(cameraId) || this.settings.get('default') || null;
  }

  async getServiceStatus(): Promise<{ available: boolean; url: string; responseTime?: number }> {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.openCVServiceUrl}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      return {
        available: response.ok,
        url: this.openCVServiceUrl,
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        available: false,
        url: this.openCVServiceUrl
      };
    }
  }
}

export const objectDetectionService = new ObjectDetectionService();
export function getObjectDetectionService(): ObjectDetectionService {
  return objectDetectionService;
}
export default objectDetectionService;
