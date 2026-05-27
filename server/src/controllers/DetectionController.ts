import { Request, Response } from 'express';
import { AppDataSource } from '../database.js';
import { DetectionConfig } from '../models/DetectionConfig.js';
import { BaseController } from './BaseController.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { serviceRegistry } from '../services/serviceRegistry.js';

export class DetectionController extends BaseController {

  async getPersonSettings(req: Request, res: Response): Promise<void> {
    try {
      const cameraId = (req.query.camera as string) || 'default';
      const settings = consolidatedDetectionService.getObjectDetectionSettings(cameraId);
      this.ok(res, { settings: settings || {} });
    } catch (error) {
      this.serverError(res, error, 'getPersonSettings');
    }
  }

  async updatePersonSettings(req: Request, res: Response): Promise<void> {
    try {
      const { minConfidence, maxDetections, targetClasses } = req.body;
      const updated = consolidatedDetectionService.updateObjectDetectionSettings('default', {
        minConfidence: minConfidence || 0.5,
        maxDetections: maxDetections || 10,
        targetClasses: targetClasses || ['person', 'dog', 'cat']
      });
      this.ok(res, { updated });
    } catch (error) {
      this.serverError(res, error, 'updatePersonSettings');
    }
  }

  async getFaceSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = consolidatedDetectionService.getFacialRecognitionSettings();
      this.ok(res, { settings: settings || {} });
    } catch (error) {
      this.serverError(res, error, 'getFaceSettings');
    }
  }

  async updateFaceSettings(req: Request, res: Response): Promise<void> {
    try {
      const { recognitionThreshold, minFaceSize } = req.body;
      const updated = consolidatedDetectionService.updateFacialRecognitionSettings({
        recognitionThreshold: recognitionThreshold || 0.6,
        minFaceSize: minFaceSize || 48,
      });
      this.ok(res, { updated });
    } catch (error) {
      this.serverError(res, error, 'updateFaceSettings');
    }
  }

  async getMotionSettings(req: Request, res: Response): Promise<void> {
    try {
      const motionDetector = serviceRegistry.getMotionDetector();
      const { cameraId } = req.query;

      if (cameraId && typeof cameraId === 'string') {
        const settings = motionDetector.getSettings(cameraId);
        if (!settings) {
          this.notFound(res, 'Camera not found');
          return;
        }
        this.ok(res, { settings, cameraId });
        return;
      }

      const streamManager = serviceRegistry.getStreamManager();
      const allCameras = streamManager.getAllCameras();
      const allSettings: Record<string, unknown> = {};
      allCameras.forEach((camera: { id: string }) => {
        allSettings[camera.id] = motionDetector.getSettings(camera.id);
      });
      this.ok(res, { settings: allSettings });
    } catch (error) {
      this.serverError(res, error, 'getMotionSettings');
    }
  }

  async updateMotionSettings(req: Request, res: Response): Promise<void> {
    try {
      const motionDetector = serviceRegistry.getMotionDetector();
      const { cameraId, sensitivity, requiredConsecutiveFrames, minContourArea, useGaussianBlur, blurKernelSize, timeZones } = req.body;

      if (!cameraId) {
        this.badRequest(res, 'cameraId is required');
        return;
      }

      const updates: Record<string, unknown> = {};
      if (sensitivity !== undefined) updates.sensitivity = sensitivity;
      if (requiredConsecutiveFrames !== undefined) updates.requiredConsecutiveFrames = requiredConsecutiveFrames;
      if (minContourArea !== undefined) updates.minContourArea = minContourArea;
      if (useGaussianBlur !== undefined) updates.useGaussianBlur = useGaussianBlur;
      if (blurKernelSize !== undefined) updates.blurKernelSize = blurKernelSize;
      if (timeZones !== undefined) updates.timeZones = timeZones;

      const updated = motionDetector.updateSettings(cameraId, updates);
      if (updated) {
        this.ok(res, { updated, cameraId });
      } else {
        this.notFound(res, 'Camera not found or update failed');
      }
    } catch (error) {
      this.serverError(res, error, 'updateMotionSettings');
    }
  }

  async triggerPersonDetection(req: Request, res: Response): Promise<void> {
    try {
      const { cameraId } = req.params;
      const streamManager = serviceRegistry.getStreamManager();
      const frame = streamManager.getLastFrame?.(cameraId) || null;

      if (!frame) {
        this.badRequest(res, 'No frame available for camera');
        return;
      }

      const results = await consolidatedDetectionService.detectObjects(cameraId, frame);
      this.ok(res, { detections: results });
    } catch (error) {
      this.serverError(res, error, 'triggerPersonDetection');
    }
  }

  async triggerFaceDetection(req: Request, res: Response): Promise<void> {
    try {
      const { cameraId } = req.params;
      const streamManager = serviceRegistry.getStreamManager();
      const frame = streamManager.getLastFrame?.(cameraId) || null;

      if (!frame) {
        this.badRequest(res, 'No frame available for camera');
        return;
      }

      const results = await consolidatedDetectionService.detectFaces(cameraId, frame);
      this.ok(res, { faces: results });
    } catch (error) {
      this.serverError(res, error, 'triggerFaceDetection');
    }
  }
}

export const detectionController = new DetectionController();
