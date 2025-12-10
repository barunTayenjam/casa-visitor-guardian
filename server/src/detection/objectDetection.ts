// STUB VERSION - Prevents HTTP hanging by disabling OpenCV loading
export interface DetectionResult {
  class: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number; };
}

export interface ObjectDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
}

export class ObjectDetectionService {
  private settings = new Map<string, ObjectDetectionSettings>();
  
  constructor() {
    console.log('ObjectDetectionService: STUB VERSION - HTTP hanging fix applied');
    this.initializeDefaultSettings();
  }
  
  private initializeDefaultSettings() {
    this.settings.set('default', { enabled: true, sensitivity: 0.5, cooldownPeriod: 1000 });
  }
  
  isReady(): boolean { return true; }
  
  async detectObjects(cameraId: string, imageBuffer: Buffer, settings?: ObjectDetectionSettings): Promise<DetectionResult[]> {
    return []; // Stub - no detection
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
