export interface AnalysisContext {
  cameraId?: string;
  cameraName?: string;
  triggerReason?: string;
  timestamp?: string;
  eventType?: string;
  detectedObjects?: string[];
  confidence?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

export interface PersonDetectionResult {
  count: number;
  people: {
    position: BoundingBox;
    description: string;
    clothing?: string;
    actions?: string[];
  }[];
  sceneDescription: string;
  processingTime: number;
  modelUsed: string;
}

export interface BboxAnalysisResult {
  boxes: BoundingBox[];
  sceneDescription: string;
  annotatedImage: string;
  rawAnalysis: {
    people: string[];
    vehicles: string[];
    objects: string[];
    animals: string[];
  };
  processingTime: number;
  modelUsed: string;
}

export interface NvidianalysisResult {
  sceneDescription: string;
  threatAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    confidence: number;
  };
  detectedEntities: {
    people: string[];
    vehicles: string[];
    animals: string[];
    objects: string[];
    actions: string[];
  };
  recommendedActions: string[];
  additionalObservations: string[];
  processingTime: number;
  modelUsed: string;
}

export interface NvidiaApiError {
  error: string;
  message: string;
  code?: string;
}

export const DEFAULT_TIMEOUT = 90000;
