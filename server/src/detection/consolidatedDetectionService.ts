/**
 * ConsolidatedDetectionService — Canonical settings & config gateway.
 * Manages motion, object detection, and facial recognition settings per camera.
 * Bridges to DetectionSettingsStore (persistence) and DetectionClient (Python pipeline).
 * NOT responsible for: processing detections, DB event storage, cleanup.
 * See: DetectionSettingsStore, DetectionClient, enhancedDetectionService (DB events).
 */
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';
import { DetectionSettingsStore } from './DetectionSettingsStore.js';
import { DetectionClient } from './DetectionClient.js';
import type { MotionSettings, ObjectDetectionSettings, FacialRecognitionSettings } from './DetectionSettingsStore.js';

export type { MotionSettings, ObjectDetectionSettings, FacialRecognitionSettings } from './DetectionSettingsStore.js';

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

export class ConsolidatedDetectionService {
  private store = new DetectionSettingsStore();
  private client = new DetectionClient();

  async loadSettingsFromDb(): Promise<void> {
    await this.store.loadFromDb();
  }

  private async writeSettings(cameraId: string): Promise<void> {
    await this.store.saveToDb(cameraId);
    const settings: any = {};
    const motion = this.store.getMotionSettings(cameraId);
    if (motion) settings.motion = motion;
    const objDet = this.store.getObjectDetectionSettings(cameraId);
    if (objDet) settings.objectDetection = objDet;
    if (cameraId === 'default') {
      settings.facialRecognition = this.store.getFacialRecognitionSettings();
    }
    await this.client.pushConfig(cameraId, settings);
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
    const current = this.store.getObjectDetectionSettings(cameraId);
    const updated = { ...current, ...settings };
    this.store.updateObjectDetectionSettings(cameraId, updated);
    await this.writeSettings(cameraId);
    return updated;
  }

  getObjectDetectionSettings(cameraId: string): ObjectDetectionSettings {
    return this.store.getObjectDetectionSettings(cameraId);
  }

  // ==================== FACIAL RECOGNITION ====================

  async updateFacialRecognitionSettings(settings: Partial<FacialRecognitionSettings>): Promise<FacialRecognitionSettings> {
    const current = this.store.getFacialRecognitionSettings();
    const updated = { ...current, ...settings };
    this.store.updateFacialRecognitionSettings(updated);
    await this.writeSettings('default');
    return updated;
  }

  getFacialRecognitionSettings(): FacialRecognitionSettings {
    return this.store.getFacialRecognitionSettings();
  }

  // ==================== MOTION SETTINGS ====================

  getMotionSettings(cameraId: string): MotionSettings {
    return this.store.getMotionSettings(cameraId);
  }

  async updateMotionSettings(cameraId: string, settings: Partial<MotionSettings>): Promise<MotionSettings> {
    const current = this.store.getMotionSettings(cameraId);
    const updated = { ...current, ...settings };
    this.store.updateMotionSettings(cameraId, updated);
    await this.writeSettings(cameraId);
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