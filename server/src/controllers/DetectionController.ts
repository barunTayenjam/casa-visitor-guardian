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
