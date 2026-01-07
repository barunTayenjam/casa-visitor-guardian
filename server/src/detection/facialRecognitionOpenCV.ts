import { DetectionResult } from './objectDetectionOpenCV.js';

export interface FacialRecognitionResult {
  id: string;
  name: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number; };
}

export type FaceDetection = FacialRecognitionResult;

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
    enabled: true,
    minConfidence: 0.7,
    recognitionThreshold: 0.6
  };
  private openCVServiceUrl: string;

  constructor() {
    console.log('FacialRecognitionService: Initializing with OpenCV service');
    this.openCVServiceUrl = process.env.OPENCV_SERVICE_URL || 'http://opencv-service:8084';
  }

  isReady(): boolean { 
    return true; 
  }

  async recognizeFaces(cameraId: string, imageBuffer: Buffer): Promise<{ faces: FacialRecognitionResult[], knownFaces: FacialRecognitionResult[], unknownFaces: FacialRecognitionResult[] }> {
    try {
      const crypto = await import('crypto');
      const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
      const fileModified = new Date().toISOString();

      const formData = new FormData();
      const uint8Array = new Uint8Array(imageBuffer);
      const blob = new Blob([uint8Array], { type: 'image/jpeg' });
      formData.append('image', blob, 'image.jpg');
      formData.append('fileHash', fileHash);
      formData.append('fileSize', imageBuffer.length.toString());
      formData.append('fileModified', fileModified);

      const response = await fetch(`${this.openCVServiceUrl}/recognize-faces`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OpenCV service returned ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.faceDetections) {
        const faces = result.faceDetections.map((face: any) => ({
          id: face.id || 'unknown',
          name: face.name || 'Unknown',
          confidence: face.confidence || 0,
          bbox: face.bbox
        }));

        const knownFaces = faces.filter((face: FacialRecognitionResult) => face.name !== 'Unknown');
        const unknownFaces = faces.filter((face: FacialRecognitionResult) => face.name === 'Unknown');

        return { faces, knownFaces, unknownFaces };
      } else {
        return { faces: [], knownFaces: [], unknownFaces: [] };
      }
    } catch (error) {
      console.error('Facial recognition error:', error);
      return { faces: [], knownFaces: [], unknownFaces: [] };
    }
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