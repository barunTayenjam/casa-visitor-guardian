import { Router, Request, Response } from 'express';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import eventSearchService from '../services/eventSearchService.js';

export class DetectionController {
  async getEvents(req: Request, res: Response) {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const events = await eventSearchService.getMotionEvents(limit);
    res.json(events);
  }

  async triggerPersonDetection(req: Request, res: Response) {
    const streamManager = serviceRegistry.getStreamManager();
    const cameraId = req.params.cameraId;
    const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
    if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });
    const currentFrame = streamManager.getCurrentFrame(cameraId);
    if (!currentFrame) return res.status(400).json({ success: false, error: 'No frame' });
    
    const result = await consolidatedDetectionService.detectObjects(cameraId, currentFrame);
    res.json({ success: true, detections: result.detections });
  }

  async updateMotionSettings(req: Request, res: Response) {
    const cameraId = req.params.cameraId;
    const settings = await consolidatedDetectionService.updateMotionSettings(cameraId, req.body);
    res.json(settings);
  }

  async getMotionSettings(req: Request, res: Response) {
    const cameraId = req.params.cameraId;
    const settings = consolidatedDetectionService.getMotionSettings(cameraId);
    res.json(settings);
  }
}

export const detectionController = new DetectionController();
