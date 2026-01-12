import { DetectionResult, FaceDetection } from '../detection/consolidatedDetectionService.js';

export interface NormalizedDetection {
  class: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface NormalizedFaceDetection {
  id: string;
  name: string;
  isKnown: boolean;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectionStorageFormat {
  object_detections: NormalizedDetection[];
  face_detections: NormalizedFaceDetection[];
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  unknown_faces_count: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RawDetection {
  class?: string;
  confidence: number | string;
  bbox?: BoundingBox;
  boundingBox?: BoundingBox;
}

interface RawFaceDetection extends RawDetection {
  id?: string;
  name?: string;
  personName?: string;
  isKnown?: boolean;
}

export class DetectionDataNormalizer {
  static normalizeDetection(detection: RawDetection): NormalizedDetection | null {
    if (!detection) return null;

    const bbox = detection.bbox || detection.boundingBox;
    
    if (!bbox) {
      console.warn('Detection missing bounding box:', detection);
      return null;
    }

    return {
      class: detection.class || 'unknown',
      confidence: Math.max(0, Math.min(1, Number(detection.confidence) || 0)),
      bbox: {
        x: Math.max(0, Number(bbox.x) || 0),
        y: Math.max(0, Number(bbox.y) || 0),
        width: Math.max(0, Number(bbox.width) || 0),
        height: Math.max(0, Number(bbox.height) || 0)
      }
    };
  }

  static normalizeFaceDetection(detection: RawFaceDetection): NormalizedFaceDetection | null {
    if (!detection) return null;

    const bbox = detection.bbox || detection.boundingBox;
    
    if (!bbox) {
      console.warn('Face detection missing bounding box:', detection);
      return null;
    }

    const name = detection.name || detection.personName || 'Unknown';
    const isKnown = detection.isKnown !== undefined 
      ? detection.isKnown 
      : name !== 'Unknown';

    return {
      id: detection.id || '',
      name: name,
      isKnown: isKnown,
      confidence: Math.max(0, Math.min(1, Number(detection.confidence) || 0)),
      bbox: {
        x: Math.max(0, Number(bbox.x) || 0),
        y: Math.max(0, Number(bbox.y) || 0),
        width: Math.max(0, Number(bbox.width) || 0),
        height: Math.max(0, Number(bbox.height) || 0)
      }
    };
  }

  static normalizeDetectionsArray(
    detections: RawDetection[] | RawFaceDetection[],
    type: 'object' | 'face'
  ): NormalizedDetection[] | NormalizedFaceDetection[] {
    if (!Array.isArray(detections)) {
      console.warn(`Expected array for ${type} detections, got:`, typeof detections);
      return [];
    }

    const normalized = detections.map((d, index) => {
      try {
        return type === 'face' 
          ? this.normalizeFaceDetection(d as RawFaceDetection)
          : this.normalizeDetection(d as RawDetection);
      } catch (error) {
        console.error(`Error normalizing ${type} detection at index ${index}:`, error);
        return null;
      }
    }).filter((d): d is NormalizedDetection => d !== null);

    return normalized;
  }

  static validateBoundingBox(bbox: BoundingBox | null | undefined): boolean {
    if (!bbox || typeof bbox !== 'object') return false;
    
    const x = Number(bbox.x);
    const y = Number(bbox.y);
    const width = Number(bbox.width);
    const height = Number(bbox.height);

    return (
      !isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height) &&
      x >= 0 && y >= 0 && width > 0 && height > 0
    );
  }

  static validateConfidence(confidence: number | string | null | undefined): boolean {
    const conf = Number(confidence);
    return !isNaN(conf) && conf >= 0 && conf <= 1;
  }

  static createDetectionStorageFormat(
    objectDetections: RawDetection[],
    faceDetections: RawFaceDetection[]
  ): DetectionStorageFormat {
    const normalizedObjects = this.normalizeDetectionsArray(objectDetections, 'object') as NormalizedDetection[];
    const normalizedFaces = this.normalizeDetectionsArray(faceDetections, 'face') as NormalizedFaceDetection[];

    const persons = normalizedObjects.filter(d => d.class === 'person');
    const knownFaces = normalizedFaces.filter(f => f.isKnown);
    const unknownFaces = normalizedFaces.filter(f => !f.isKnown);

    return {
      object_detections: normalizedObjects,
      face_detections: normalizedFaces,
      persons_detected: persons.length,
      faces_detected: normalizedFaces.length,
      known_faces_count: knownFaces.length,
      unknown_faces_count: unknownFaces.length
    };
  }

  static sanitizeForStorage(data: DetectionStorageFormat): string {
    try {
      return JSON.stringify({
        object_detections: data.object_detections,
        face_detections: data.face_detections,
        persons_detected: data.persons_detected,
        faces_detected: data.faces_detected,
        known_faces_count: data.known_faces_count,
        unknown_faces_count: data.unknown_faces_count
      });
    } catch (error) {
      console.error('Error sanitizing detection data for storage:', error);
      return JSON.stringify({
        object_detections: [],
        face_detections: [],
        persons_detected: 0,
        faces_detected: 0,
        known_faces_count: 0,
        unknown_faces_count: 0
      });
    }
  }

  static parseFromStorage(jsonData: string | null | Record<string, unknown>): DetectionStorageFormat {
    if (!jsonData) {
      return {
        object_detections: [],
        face_detections: [],
        persons_detected: 0,
        faces_detected: 0,
        known_faces_count: 0,
        unknown_faces_count: 0
      };
    }

    try {
      const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData as string) : jsonData;
      
      return {
        object_detections: this.normalizeDetectionsArray((parsed as Record<string, unknown>).object_detections as RawDetection[], 'object') as NormalizedDetection[],
        face_detections: this.normalizeDetectionsArray((parsed as Record<string, unknown>).face_detections as RawFaceDetection[], 'face') as NormalizedFaceDetection[],
        persons_detected: Math.max(0, Number((parsed as Record<string, unknown>).persons_detected) || 0),
        faces_detected: Math.max(0, Number((parsed as Record<string, unknown>).faces_detected) || 0),
        known_faces_count: Math.max(0, Number((parsed as Record<string, unknown>).known_faces_count) || 0),
        unknown_faces_count: Math.max(0, Number((parsed as Record<string, unknown>).unknown_faces_count) || 0)
      };
    } catch (error) {
      console.error('Error parsing detection data from storage:', error);
      return {
        object_detections: [],
        face_detections: [],
        persons_detected: 0,
        faces_detected: 0,
        known_faces_count: 0,
        unknown_faces_count: 0
      };
    }
  }
}

export default DetectionDataNormalizer;
