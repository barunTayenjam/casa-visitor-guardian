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

// LOW_RESOURCE_MODE config for minimal resource environments (1 core, 2GB RAM)
export const lowResourceDetectionConfig: DetectionConfig = {
  ...defaultDetectionConfig,
  sensitivity: 75,
  cooldownPeriod: 15000,
  detectionInterval: 5000,
  maxEventsPerHour: 50,
  nightModeSensitivity: 75,
  requiredConsecutiveFrames: 3,
  minContourArea: 500,
  useGaussianBlur: true,
  blurKernelSize: 5,
  timeZones: {
    day: { start: '06:00', end: '22:00', sensitivityMultiplier: 1.0 },
    night: { start: '22:00', end: '06:00', sensitivityMultiplier: 1.1 }
  }
};

export function loadDetectionConfig(): DetectionConfig {
  // Check if LOW_RESOURCE_MODE is enabled
  const lowResourceMode = process.env.LOW_RESOURCE_MODE === 'true' || process.env.LOW_RESOURCE_MODE === '1';
  
  if (lowResourceMode) {
    return lowResourceDetectionConfig;
  }
  
  return defaultDetectionConfig;
}

export default defaultDetectionConfig;