export interface DetectionResult {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  label?: string;
}

export interface FaceDetection {
  id: string;
  name: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface MotionSettings {
  sensitivity: number;
  requiredConsecutiveFrames: number;
  minContourArea: number;
  useGaussianBlur: boolean;
  blurKernelSize: number;
  timeZones?: unknown;
}

export interface PersonDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
  minConfidence?: number;
  maxDetections?: number;
  targetClasses?: string[];
}

export interface FaceRecognitionSettings {
  enabled: boolean;
  minConfidence: number;
  recognitionThreshold?: number;
  minFaceSize?: number;
}
