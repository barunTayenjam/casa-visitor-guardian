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

export interface PersonAttributeSummary {
  clothing?: string | null;
  clothingColors?: string[];
  facing?: string | null;
  distance?: string | null;
  carryingItem?: string | null;
  bodyLanguage?: string | null;
  actions?: string[];
  positionPct?: { x: number; y: number; width: number; height: number } | null;
}

export interface TrackSummary {
  class: string;
  confidence: number | null;
  trackId?: number | null;
  trackState?: string | null;
  trackletLen?: number | null;
  identity?: string | null;
  identityConfidence?: number | null;
  humanVerified?: boolean | null;
  verificationTier?: string | null;
  personAttributes?: PersonAttributeSummary | null;
}

export interface SensorMetadata {
  tracks: TrackSummary[];
  localThreat?: { level?: string; factors?: string[] } | null;
  sceneContext?: Record<string, unknown> | null;
  motionStats?: { motion_pixels?: number; motion_percentage?: number; confidence?: number } | null;
}

export interface AnalysisContext {
  cameraId?: string;
  cameraName?: string;
  triggerReason?: string;
  timestamp?: string;
  eventType?: string;
  detectedObjects?: string[];
  confidence?: number;
  yoloDetections?: NormalizedDetection[];
  sensorMetadata?: SensorMetadata;
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
  sceneContext?: {
    environment: string;
    weather?: string;
    lighting?: string;
  };
  processingTime: number;
  modelUsed: string;
}

export interface BboxAnalysisResult {
  boxes: BoundingBox[];
  sceneDescription: string;
  sceneContext?: {
    environment: string;
    weather?: string;
    lighting?: string;
  };
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
  sceneContext?: {
    environment: 'indoor' | 'outdoor' | 'unknown';
    weather?: string;
    lighting?: string;
    timeOfDay?: string;
  };
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
