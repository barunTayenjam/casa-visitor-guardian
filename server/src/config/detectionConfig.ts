export interface DetectionConfig {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
  detectionInterval: number;
  minConfidence: number;
  maxEventsPerHour: number;
  adaptiveMode: boolean;
  nightModeSensitivity: number;
  quietHours: { start: string; end: string };
  autoDetectObjects: boolean;
  autoDetectFaces: boolean;
  detectionPriority: 'immediate' | 'deferred';
  requiredConsecutiveFrames: number;
  maxConsecutiveResetTime: number;
  minContourArea: number;
  useGaussianBlur: boolean;
  blurKernelSize: number;
  timeZones: {
    day: { start: string; end: string; sensitivityMultiplier: number };
    night: { start: string; end: string; sensitivityMultiplier: number };
  };
}

export const defaultDetectionConfig: DetectionConfig = {
  enabled: true,
  sensitivity: 90,
  cooldownPeriod: 10000,
  detectionInterval: 3000,
  minConfidence: 5,
  maxEventsPerHour: 100,
  adaptiveMode: true,
  nightModeSensitivity: 90,
  quietHours: { start: '22:00', end: '06:00' },
  autoDetectObjects: false,
  autoDetectFaces: false,
  detectionPriority: 'deferred',
  requiredConsecutiveFrames: 3,
  maxConsecutiveResetTime: 3000,
  minContourArea: 500,
  useGaussianBlur: true,
  blurKernelSize: 5,
  timeZones: {
    day: { start: '06:00', end: '22:00', sensitivityMultiplier: 1.0 },
    night: { start: '22:00', end: '06:00', sensitivityMultiplier: 1.2 }
  }
};

export function loadDetectionConfig(): DetectionConfig {
  return defaultDetectionConfig;
}

export default defaultDetectionConfig;