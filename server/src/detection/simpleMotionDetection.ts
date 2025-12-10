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
  constructor() {
    console.log('SimpleMotionDetection: STUB VERSION - HTTP hanging fix applied');
  }
  
  isReady(): boolean { return true; }
  
  async detectMotion(cameraId: string, imageBuffer: Buffer): Promise<MotionEvent | null> {
    return null; // Stub - no motion detection
  }
}

export const motionDetector = new SimpleMotionDetection();
export function getMotionDetector(): SimpleMotionDetection {
  return motionDetector;
}
export default motionDetector;
