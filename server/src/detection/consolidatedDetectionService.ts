export interface DetectionResult {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  label?: string;
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
    minConfidence: 0.5,
    recognitionThreshold: 0.55
  };
  private initialized = false;

  constructor() {
    this.initializeDefaultSettings();
    this.initialized = true;
  }

  private initializeDefaultSettings() {
    this.objectDetectionSettings.set('default', { 
      enabled: true, 
      sensitivity: 50,
      cooldownPeriod: 1000,
      minConfidence: 0.55,
      maxDetections: 10,
      targetClasses: ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'dog', 'cat', 'bird', 'horse']
    });
  }

  async detectObjects(cameraId: string, imageBuffer: Buffer): Promise<{ detections: DetectionResult[] }> {
    console.warn('ConsolidatedDetectionService: detectObjects() called but HTTP detection path is removed. Detection now runs via the Python WebSocket pipeline.');
    return { detections: [] };
  }

  async detectFaces(cameraId: string, imageBuffer: Buffer): Promise<{ faces: FaceDetection[], knownFaces: FaceDetection[], unknownFaces: FaceDetection[] }> {
    console.warn('ConsolidatedDetectionService: detectFaces() called but HTTP detection path is removed. Detection now runs via the Python WebSocket pipeline.');
    return { faces: [], knownFaces: [], unknownFaces: [] };
  }

  async getServiceStatus(): Promise<{ available: boolean; url: string; responseTime?: number }> {
    console.warn('ConsolidatedDetectionService: getServiceStatus() called but HTTP health check path is removed.');
    return { available: true, url: 'python-ws://internal' };
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

}

export const consolidatedDetectionService = new ConsolidatedDetectionService();
export function getConsolidatedDetectionService(): ConsolidatedDetectionService {
  return consolidatedDetectionService;
}
export default consolidatedDetectionService;