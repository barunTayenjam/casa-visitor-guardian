// STUB VERSION - Prevents HTTP hanging
export interface FacialRecognitionResult {
  personId?: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number; };
}

export interface KnownPerson {
  id: string;
  name: string;
  imagePaths: string[];
}

export interface ObjectDetectionSettings {
  enabled: boolean;
  minConfidence: number;
  recognitionThreshold?: number;
  minFaceSize?: number;
  livenessDetection?: boolean;
}

export class FacialRecognitionService {
  private knownPersons: Map<string, KnownPerson> = new Map();
  private settings: ObjectDetectionSettings = {
    enabled: false,
    minConfidence: 0.7
  };
  
  constructor() {
    console.log('FacialRecognitionService: STUB VERSION - HTTP hanging fix applied');
  }
  
  isReady(): boolean { return true; }
  
  async recognizeFaces(imageBuffer: Buffer): Promise<{ faces: FacialRecognitionResult[] }> {
    return { faces: [] }; // Stub - no recognition
  }
  
  getSettings(): ObjectDetectionSettings {
    return this.settings;
  }
  
  updateSettings(settings: Partial<ObjectDetectionSettings>): boolean {
    this.settings = { ...this.settings, ...settings };
    return true;
  }
  
  getKnownPersons(): KnownPerson[] {
    return Array.from(this.knownPersons.values());
  }
  
  addKnownPerson(name: string, imagePath: string): string {
    const id = Date.now().toString();
    const person: KnownPerson = {
      id,
      name,
      imagePaths: [imagePath]
    };
    this.knownPersons.set(id, person);
    return id;
  }
}

export const facialRecognitionService = new FacialRecognitionService();
export function getFacialRecognitionService(): FacialRecognitionService {
  return facialRecognitionService;
}
export default facialRecognitionService;
