import { consolidatedDetectionService, DetectionResult } from './consolidatedDetectionService.js';

export type { DetectionResult };

export interface ObjectDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
  minConfidence?: number;
  maxDetections?: number;
  targetClasses?: string[];
}

export class ObjectDetectionService {
  private settings = new Map<string, ObjectDetectionSettings>();
  
  constructor() {
    console.log('ObjectDetectionService: Using consolidated detection service');
    this.initializeDefaultSettings();
  }
  
  private initializeDefaultSettings() {
    this.settings.set('default', { 
      enabled: true, 
      sensitivity: 0.5, 
      cooldownPeriod: 1000,
      minConfidence: 0.3,
      maxDetections: 20,
      targetClasses: ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'dog', 'cat']
    });
  }
  
  isReady(): boolean { 
    return true; 
  }
  
  async detectObjects(imageBuffer: Buffer, cameraId: string = 'default'): Promise<{ detections: DetectionResult[] }> {
    const settings = this.settings.get(cameraId) || this.settings.get('default');
    
    if (!settings?.enabled) {
      return { detections: [] };
    }
    
    try {
      const result = await consolidatedDetectionService.detectObjects(cameraId, imageBuffer);
      
      // Apply additional filtering based on settings
      let filteredDetections = result.detections;
      
      if (settings.minConfidence) {
        filteredDetections = filteredDetections.filter(d => d.confidence >= settings.minConfidence!);
      }
      
      if (settings.targetClasses && settings.targetClasses.length > 0) {
        filteredDetections = filteredDetections.filter(d => 
          settings.targetClasses!.includes(d.class)
        );
      }
      
      if (settings.maxDetections) {
        filteredDetections = filteredDetections.slice(0, settings.maxDetections);
      }
      
      return { detections: filteredDetections };
    } catch (error) {
      console.error('ObjectDetectionService: Detection failed:', error);
      return { detections: [] };
    }
  }
  
  updateSettings(cameraId: string, settings: Partial<ObjectDetectionSettings>): boolean {
    const current = this.settings.get(cameraId) || this.settings.get('default')!;
    this.settings.set(cameraId, { ...current, ...settings });
    return true;
  }
  
  getSettings(cameraId: string): ObjectDetectionSettings | null {
    return this.settings.get(cameraId) || this.settings.get('default') || null;
  }
}

export const objectDetectionService = new ObjectDetectionService();
export function getObjectDetectionService(): ObjectDetectionService {
  return objectDetectionService;
}
export default objectDetectionService;
