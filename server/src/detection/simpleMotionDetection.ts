// STUB VERSION - Prevents HTTP hanging
export interface MotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
}

export interface MotionDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
}

export class SimpleMotionDetection {
  private settings: Map<string, MotionDetectionSettings> = new Map();
  
  constructor() {
    console.log('SimpleMotionDetection: STUB VERSION - HTTP hanging fix applied');
  }
  
  isReady(): boolean { return true; }
  
  async detectMotion(cameraId: string, imageBuffer: Buffer): Promise<MotionEvent | null> {
    return null; // Stub - no motion detection
  }
  
  getSettings(cameraId: string): MotionDetectionSettings | null {
    return this.settings.get(cameraId) || {
      enabled: false,
      sensitivity: 0.5,
      cooldownPeriod: 5000
    };
  }
  
  updateSettings(cameraId: string, settings: Partial<MotionDetectionSettings>): boolean {
    const currentSettings = this.getSettings(cameraId);
    if (currentSettings) {
      this.settings.set(cameraId, { ...currentSettings, ...settings });
      return true;
    }
    return false;
  }
}

export const motionDetector = new SimpleMotionDetection();
export function getMotionDetector(): SimpleMotionDetection {
  return motionDetector;
}
export default motionDetector;
