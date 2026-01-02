import { OpenCVServiceClient } from '../services/opencvServiceClient.js';
import { DetectionResult } from './objectDetectionOpenCV.js';

export interface FacialRecognitionResult {
  id: string;
  name: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number; };
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
    enabled: true,
    minConfidence: 0.7,
    recognitionThreshold: 0.6
  };
  private opencvService: OpenCVServiceClient;

  constructor() {
    console.log('FacialRecognitionService: Initializing with OpenCV service');
    this.opencvService = new OpenCVServiceClient(process.env.OPENCV_SERVICE_URL || 'http://opencv-service:8084');
  }

  isReady(): boolean { 
    return true; 
  }

  async recognizeFaces(cameraId: string, imageBuffer: Buffer): Promise<{ faces: FacialRecognitionResult[], knownFaces: FacialRecognitionResult[], unknownFaces: FacialRecognitionResult[] }> {
    try {
      // Generate a quick hash for the image
      const crypto = await import('crypto');
      const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex');

      // Get image stats
      const fileModified = new Date().toISOString();

      // Save image temporarily to shared location accessible by both containers
      const fs = await import('fs');
      const path = await import('path');

      const tempDir = '/app/public/events/temp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempImagePath = path.join(tempDir, `face_${fileHash}.jpg`);
      fs.writeFileSync(tempImagePath, imageBuffer);

      try {
        // Call the OpenCV service with the temporary file path
        const result = await this.opencvService.recognizeFaces({
          imagePath: tempImagePath,
          fileHash,
          fileSize: imageBuffer.length,
          fileModified
        });

        if (result.success && result.faceDetections) {
          // Transform the OpenCV result to our expected format
          const faces = result.faceDetections.map(face => ({
            id: face.id || 'unknown',
            name: face.name || 'Unknown',
            confidence: face.confidence || 0,
            bbox: face.bbox
          }));

          // Separate known and unknown faces
          const knownFaces = faces.filter(face => face.name !== 'Unknown');
          const unknownFaces = faces.filter(face => face.name === 'Unknown');

          return { faces, knownFaces, unknownFaces };
        } else {
          return { faces: [], knownFaces: [], unknownFaces: [] };
        }
      } finally {
        // Clean up the temporary file
        try {
          fs.unlinkSync(tempImagePath);
        } catch (cleanupError) {
          console.warn(`Failed to clean up temporary file ${tempImagePath}:`, cleanupError);
        }
      }
    } catch (error) {
      console.error('Facial recognition error:', error);
      return { faces: [], knownFaces: [], unknownFaces: [] }; // Return empty arrays on error
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