/**
 * Detection Configuration for Home Security System
 * Contains settings for person detection, motion detection, and facial recognition
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Person Detection Configuration
export interface PersonDetectionConfig {
  // YOLO model settings
  modelPath: string;
  configPath: string;
  namesPath: string;
  
  // Detection thresholds
  minConfidence: number;        // Minimum confidence for person detection (0-1)
  nmsThreshold: number;         // Non-maximum suppression threshold (0-1)
  minArea: number;              // Minimum area for person detection (pixels)
  maxDetections: number;        // Maximum number of detections per frame
  
  // Post-processing settings
  aspectRatioMin: number;       // Minimum aspect ratio for person detection
  aspectRatioMax: number;       // Maximum aspect ratio for person detection
}

// Motion Detection Configuration
export interface MotionDetectionConfig {
  // Motion sensitivity settings
  sensitivity: number;          // Overall sensitivity (0-100)
  minAreaThreshold: number;     // Minimum motion area to trigger detection
  humanMotionThreshold: number; // Threshold for human-like motion patterns
  
  // Temporal settings
  cooldownPeriod: number;       // Time between detections (ms)
  detectionInterval: number;    // How often to check for motion (ms)
  maxEventsPerHour: number;     // Maximum events per hour per camera
  
  // Adaptive settings
  adaptiveMode: boolean;        // Enable adaptive sensitivity
  nightModeSensitivity: number; // Sensitivity during night hours
  quietHours: { start: string; end: string }; // Reduce detection during quiet hours
}

// Facial Recognition Configuration
export interface FacialRecognitionConfig {
  // Model settings
  faceModelPath: string;
  recognitionModelPath: string;
  
  // Recognition thresholds
  recognitionThreshold: number; // Recognition confidence threshold (0-1)
  minFaceSize: number;          // Minimum face size to detect (pixels)
  maxFacesPerFrame: number;     // Maximum faces to process per frame
  
  // Processing settings
  saveUnknownFaces: boolean;    // Whether to save unknown faces
  enableLivenessDetection: boolean; // Enable liveness detection
}

// Overall Detection Configuration
export interface DetectionConfig {
  personDetection: PersonDetectionConfig;
  motionDetection: MotionDetectionConfig;
  facialRecognition: FacialRecognitionConfig;
  enabled: boolean;             // Whether detection is enabled globally
  enableBatchProcessing: boolean; // Whether to enable batch processing on motion
}

// Default configuration values
export const defaultDetectionConfig: DetectionConfig = {
  personDetection: {
    modelPath: path.join(__dirname, '../../../models/yolov4-tiny.weights'),
    configPath: path.join(__dirname, '../../../models/yolov4-tiny.cfg'),
    namesPath: path.join(__dirname, '../../../models/coco.names'),
    minConfidence: 0.6,
    nmsThreshold: 0.4,
    minArea: 2000,
    maxDetections: 10,
    aspectRatioMin: 0.2,
    aspectRatioMax: 3.0
  },
  motionDetection: {
    sensitivity: 40,
    minAreaThreshold: 500,
    humanMotionThreshold: 0.5,
    cooldownPeriod: 10000,
    detectionInterval: 2000,
    maxEventsPerHour: 50,
    adaptiveMode: true,
    nightModeSensitivity: 50,
    quietHours: { start: '22:00', end: '06:00' }
  },
  facialRecognition: {
    faceModelPath: path.join(__dirname, '../../../models/face_detection_yunet_2023mar.onnx'),
    recognitionModelPath: path.join(__dirname, '../../../models/face_recognizer_fast.onnx'),
    recognitionThreshold: 0.6,
    minFaceSize: 48,
    maxFacesPerFrame: 5,
    saveUnknownFaces: true,
    enableLivenessDetection: false
  },
  enabled: true,
  enableBatchProcessing: true
};

// Load detection configuration from file or return defaults
export function loadDetectionConfig(): DetectionConfig {
  try {
    // Check for custom config file
    const customConfigPath = path.join(__dirname, '../../../detection.config.json');
    
    if (fs.existsSync(customConfigPath)) {
      const configData = JSON.parse(fs.readFileSync(customConfigPath, 'utf8'));
      return mergeConfig(defaultDetectionConfig, configData);
    }
    
    return defaultDetectionConfig;
  } catch (error) {
    console.warn('Failed to load custom detection config, using defaults:', error);
    return defaultDetectionConfig;
  }
}

// Merge default config with custom config
function mergeConfig(defaultConfig: DetectionConfig, customConfig: Partial<DetectionConfig>): DetectionConfig {
  return {
    ...defaultConfig,
    ...customConfig,
    personDetection: {
      ...defaultConfig.personDetection,
      ...(customConfig.personDetection || {})
    },
    motionDetection: {
      ...defaultConfig.motionDetection,
      ...(customConfig.motionDetection || {})
    },
    facialRecognition: {
      ...defaultConfig.facialRecognition,
      ...(customConfig.facialRecognition || {})
    }
  };
}

// Validate detection configuration
export function validateDetectionConfig(config: DetectionConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate paths exist
  if (!fs.existsSync(config.personDetection.modelPath)) {
    errors.push(`Person detection model file not found: ${config.personDetection.modelPath}`);
  }
  if (!fs.existsSync(config.personDetection.configPath)) {
    errors.push(`Person detection config file not found: ${config.personDetection.configPath}`);
  }
  if (!fs.existsSync(config.personDetection.namesPath)) {
    errors.push(`Person detection names file not found: ${config.personDetection.namesPath}`);
  }
  if (!fs.existsSync(config.facialRecognition.faceModelPath)) {
    errors.push(`Face detection model file not found: ${config.facialRecognition.faceModelPath}`);
  }
  if (!fs.existsSync(config.facialRecognition.recognitionModelPath)) {
    errors.push(`Face recognition model file not found: ${config.facialRecognition.recognitionModelPath}`);
  }

  // Validate numeric ranges
  if (config.personDetection.minConfidence < 0 || config.personDetection.minConfidence > 1) {
    errors.push('Person detection minConfidence must be between 0 and 1');
  }
  if (config.personDetection.nmsThreshold < 0 || config.personDetection.nmsThreshold > 1) {
    errors.push('Person detection nmsThreshold must be between 0 and 1');
  }
  if (config.motionDetection.sensitivity < 0 || config.motionDetection.sensitivity > 100) {
    errors.push('Motion detection sensitivity must be between 0 and 100');
  }
  if (config.facialRecognition.recognitionThreshold < 0 || config.facialRecognition.recognitionThreshold > 1) {
    errors.push('Facial recognition threshold must be between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Config loader with validation as a function
export const detectionConfig = loadDetectionConfig();

export default detectionConfig;

// Function to validate config at runtime when needed
export function validateAndLoadDetectionConfig(): { isValid: boolean; errors: string[]; config: DetectionConfig } {
  const config = loadDetectionConfig();
  const validation = validateDetectionConfig(config);

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    config
  };
}