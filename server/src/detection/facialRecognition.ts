// STUB VERSION - Prevents HTTP hanging
export interface FacialRecognitionResult {
  personId?: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number; };
}

export class FacialRecognitionService {
  constructor() {
    console.log('FacialRecognitionService: STUB VERSION - HTTP hanging fix applied');
  }
  
  isReady(): boolean { return true; }
  
  async recognizeFaces(imageBuffer: Buffer): Promise<FacialRecognitionResult[]> {
    return []; // Stub - no recognition
  }
}

export const facialRecognitionService = new FacialRecognitionService();
export function getFacialRecognitionService(): FacialRecognitionService {
  return facialRecognitionService;
}
export default facialRecognitionService;
