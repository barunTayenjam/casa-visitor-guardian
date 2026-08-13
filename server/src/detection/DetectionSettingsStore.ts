import { AppDataSource } from '../database.js';
import { logger } from '../utils/logger.js';

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
  targetClasses: [
    'person',
    'car',
    'truck',
    'bus',
    'motorcycle',
    'bicycle',
    'dog',
    'cat',
    'bird',
    'horse',
  ],
};

const DEFAULT_FACIAL_RECOGNITION_SETTINGS: FacialRecognitionSettings = {
  enabled: true,
  minConfidence: 0.5,
  recognitionThreshold: 0.55,
};

export class DetectionSettingsStore {
  private objectDetectionSettings = new Map<string, ObjectDetectionSettings>();
  private facialRecognitionSettings: FacialRecognitionSettings = {
    ...DEFAULT_FACIAL_RECOGNITION_SETTINGS,
  };
  private motionSettingsStore = new Map<string, MotionSettings>();

  constructor() {
    this.objectDetectionSettings.set('default', { ...DEFAULT_OBJECT_DETECTION_SETTINGS });
  }

  async loadFromDb(): Promise<void> {
    try {
      const rows = (await AppDataSource.query(
        'SELECT camera_id, settings FROM camera_settings',
      )) as { camera_id: string; settings: any }[];

      for (const row of rows) {
        const s = row.settings;
        if (s.motion) {
          this.motionSettingsStore.set(row.camera_id, { ...DEFAULT_MOTION_SETTINGS, ...s.motion });
        }
        if (s.objectDetection) {
          this.objectDetectionSettings.set(row.camera_id, {
            ...DEFAULT_OBJECT_DETECTION_SETTINGS,
            ...s.objectDetection,
          });
        }
      }

      const globalRow = rows.find((r) => r.camera_id === 'default');
      if (globalRow?.settings?.facialRecognition) {
        this.facialRecognitionSettings = {
          ...DEFAULT_FACIAL_RECOGNITION_SETTINGS,
          ...globalRow.settings.facialRecognition,
        };
      }
      logger.info(`Loaded detection settings for ${rows.length} cameras`, 'DetectionSettingsStore');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`Could not load settings from database: ${msg}`, 'DetectionSettingsStore');
    }
  }

  async saveToDb(cameraId: string): Promise<void> {
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
        [cameraId, JSON.stringify(settings)],
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save settings for ${cameraId}: ${msg}`, 'DetectionSettingsStore');
      throw error;
    }
  }

  getObjectDetectionSettings(cameraId: string): ObjectDetectionSettings {
    return (
      this.objectDetectionSettings.get(cameraId) ||
      this.objectDetectionSettings.get('default') || { ...DEFAULT_OBJECT_DETECTION_SETTINGS }
    );
  }

  updateObjectDetectionSettings(cameraId: string, settings: ObjectDetectionSettings): void {
    this.objectDetectionSettings.set(cameraId, settings);
  }

  getFacialRecognitionSettings(): FacialRecognitionSettings {
    return this.facialRecognitionSettings;
  }

  updateFacialRecognitionSettings(settings: FacialRecognitionSettings): void {
    this.facialRecognitionSettings = settings;
  }

  getMotionSettings(cameraId: string): MotionSettings {
    return this.motionSettingsStore.get(cameraId) || { ...DEFAULT_MOTION_SETTINGS };
  }

  updateMotionSettings(cameraId: string, settings: MotionSettings): void {
    this.motionSettingsStore.set(cameraId, settings);
  }
}
