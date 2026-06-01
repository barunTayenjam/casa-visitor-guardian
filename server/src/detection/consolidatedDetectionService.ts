import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';

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

export interface DetectionResponse {
  success: boolean;
  cached: boolean;
  detections?: DetectionResult[];
  faceDetections?: FaceDetection[];
  processingTime?: number;
  fileHash: string;
  error?: string;
}

export interface ObjectDetectionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
  minConfidence?: number;
  maxDetections?: number;
  targetClasses?: string[];
}

export interface FacialRecognitionSettings {
  enabled: boolean;
  minConfidence: number;
  recognitionThreshold?: number;
  minFaceSize?: number;
}

export interface MotionSettings {
  sensitivity: number;
  requiredConsecutiveFrames: number;
  minContourArea: number;
  useGaussianBlur: boolean;
  blurKernelSize: number;
  timeZones: Record<string, { start: string; end: string; sensitivityMultiplier: number }>;
}

const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  sensitivity: 90,
  requiredConsecutiveFrames: 3,
  minContourArea: 500,
  useGaussianBlur: true,
  blurKernelSize: 5,
  timeZones: {},
};

const DEFAULT_OBJECT_DETECTION_SETTINGS: ObjectDetectionSettings = {
  enabled: true,
  sensitivity: 50,
  cooldownPeriod: 1000,
  minConfidence: 0.55,
  maxDetections: 10,
  targetClasses: ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'dog', 'cat', 'bird', 'horse'],
};

const DEFAULT_FACIAL_RECOGNITION_SETTINGS: FacialRecognitionSettings = {
  enabled: true,
  minConfidence: 0.5,
  recognitionThreshold: 0.55,
};

export class ConsolidatedDetectionService {
  private objectDetectionSettings = new Map<string, ObjectDetectionSettings>();
  private facialRecognitionSettings: FacialRecognitionSettings = { ...DEFAULT_FACIAL_RECOGNITION_SETTINGS };
  private motionSettingsStore = new Map<string, MotionSettings>();
  private initialized = false;

  constructor() {
    this.initializeDefaultSettings();
    this.initialized = true;
  }

  private initializeDefaultSettings() {
    this.objectDetectionSettings.set('default', { ...DEFAULT_OBJECT_DETECTION_SETTINGS });
  }

  async loadSettingsFromDb(): Promise<void> {
    try {
      const rows = await AppDataSource.query(
        'SELECT camera_id, settings FROM camera_settings'
      ) as { camera_id: string; settings: any }[];

      for (const row of rows) {
        const s = row.settings;
        if (s.motion) {
          this.motionSettingsStore.set(row.camera_id, { ...DEFAULT_MOTION_SETTINGS, ...s.motion });
        }
        if (s.objectDetection) {
          this.objectDetectionSettings.set(row.camera_id, { ...DEFAULT_OBJECT_DETECTION_SETTINGS, ...s.objectDetection });
        }
      }

      const globalRow = rows.find(r => r.camera_id === 'default');
      if (globalRow?.settings?.facialRecognition) {
        this.facialRecognitionSettings = { ...DEFAULT_FACIAL_RECOGNITION_SETTINGS, ...globalRow.settings.facialRecognition };
      }

      logger.info(`Loaded settings for ${rows.length} cameras from database`, 'Detection');
    } catch (error: any) {
      logger.warn(`Could not load settings from database: ${error.message}. Using defaults.`, 'Detection');
    }
  }

  private async writeSettingsToDb(cameraId: string): Promise<void> {
    try {
      const settings: any = {};

      const motion = this.motionSettingsStore.get(cameraId);
      if (motion) settings.motion = motion;

      const objDet = this.objectDetectionSettings.get(cameraId);
      if (objDet) settings.objectDetection = objDet;

      if (cameraId === 'default') {
        settings.facialRecognition = this.facialRecognitionSettings;
      }

      await AppDataSource.query(
        `INSERT INTO camera_settings (camera_id, settings)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (camera_id)
         DO UPDATE SET settings = $2::jsonb`,
        [cameraId, JSON.stringify(settings)]
      );

      try {
        const { getOpenCVClient } = await import('../services/opencvMicroserviceClient.js');
        const opencvClient = getOpenCVClient();
        if (opencvClient) {
          await opencvClient.pushDetectionConfig(cameraId, settings);
        }
      } catch (pushError) {
        logger.warn(`Failed to push config to Python: ${pushError}`, 'Detection');
      }
    } catch (error: any) {
      logger.error(`Failed to save settings for camera ${cameraId}: ${error.message}`, 'Detection');
    }
  }

  async detectObjects(cameraId: string, imageBuffer: Buffer): Promise<{ detections: DetectionResult[] }> {
    throw new Error('HTTP detection endpoint is disabled. Detection runs via Python WebSocket pipeline (port 9070).');
  }

  async detectFaces(cameraId: string, imageBuffer: Buffer): Promise<{ faces: FaceDetection[], knownFaces: FaceDetection[], unknownFaces: FaceDetection[] }> {
    throw new Error('HTTP face detection endpoint is disabled. Detection runs via Python WebSocket pipeline (port 9070).');
  }

  async getServiceStatus(): Promise<{ available: boolean; url: string; responseTime?: number }> {
    logger.warn('ConsolidatedDetectionService: getServiceStatus() called but HTTP health check path is removed.', 'Detection');
    return { available: true, url: 'python-ws://internal' };
  }

  // ==================== OBJECT DETECTION ====================

  async updateObjectDetectionSettings(cameraId: string, settings: Partial<ObjectDetectionSettings>): Promise<ObjectDetectionSettings> {
    const current = this.objectDetectionSettings.get(cameraId) || this.objectDetectionSettings.get('default') || { ...DEFAULT_OBJECT_DETECTION_SETTINGS };
    const updated = { ...current, ...settings };
    this.objectDetectionSettings.set(cameraId, updated);
    await this.writeSettingsToDb(cameraId);
    return updated;
  }

  getObjectDetectionSettings(cameraId: string): ObjectDetectionSettings | null {
    return this.objectDetectionSettings.get(cameraId) || this.objectDetectionSettings.get('default') || null;
  }

  // ==================== FACIAL RECOGNITION ====================

  async updateFacialRecognitionSettings(settings: Partial<FacialRecognitionSettings>): Promise<FacialRecognitionSettings> {
    this.facialRecognitionSettings = { ...this.facialRecognitionSettings, ...settings };
    await this.writeSettingsToDb('default');
    return this.facialRecognitionSettings;
  }

  getFacialRecognitionSettings(): FacialRecognitionSettings {
    return this.facialRecognitionSettings;
  }

  // ==================== MOTION SETTINGS ====================

  getMotionSettings(cameraId: string): MotionSettings {
    return this.motionSettingsStore.get(cameraId) || { ...DEFAULT_MOTION_SETTINGS };
  }

  async updateMotionSettings(cameraId: string, settings: Partial<MotionSettings>): Promise<MotionSettings> {
    const current = this.motionSettingsStore.get(cameraId) || { ...DEFAULT_MOTION_SETTINGS };
    const updated = { ...current, ...settings };
    this.motionSettingsStore.set(cameraId, updated);
    await this.writeSettingsToDb(cameraId);
    return updated;
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Consolidated detection service resources cleaned up', 'Detection');
    } catch (error) {
      logger.error('Error cleaning consolidated detection service resources', 'Detection', error);
    }
  }

  async cleanupHook(): Promise<void> {
    logger.info('Consolidated detection service cleanup hook triggered', 'Detection');
    await this.cleanup();
  }
}

export const consolidatedDetectionService = new ConsolidatedDetectionService();
export function getConsolidatedDetectionService(): ConsolidatedDetectionService {
  return consolidatedDetectionService;
}
export default consolidatedDetectionService;
