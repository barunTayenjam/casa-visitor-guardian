import { logger } from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateQuery, validateParams, validateBody } from '../middleware/zodValidation.js';
import { Server as SocketIOServer } from 'socket.io';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { inMemoryState } from '../services/inMemoryStateService.js';
import eventSearchService from '../services/eventSearchService.js';
import { optionalAuth, requireUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

const limitQuerySchema = z.object({
  limit: z.preprocess(v => (v ? parseInt(v as string, 10) : undefined), z.number().min(1).max(1000).optional())
});

const cameraIdParamsSchema = z.object({
  cameraId: z.string().regex(/^[a-zA-Z0-9_-]+$/)
});

const analyzeBodySchema = z.object({
  enablePersonDetection: z.boolean().optional(),
  enableFaceDetection: z.boolean().optional()
});

router.get('/events', optionalAuth, validateQuery(limitQuerySchema), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const events = await eventSearchService.getMotionEvents(limit);
    res.json({ success: true, events });
  } catch (error) {
     logger.error('Error getting motion events', 'Motion', error);
    res.status(500).json({ success: false, error: 'Failed to get motion events' });
  }
});

router.get('/:cameraId/events', optionalAuth, validateParams(cameraIdParamsSchema), validateQuery(limitQuerySchema), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 1000);
    const events = await eventSearchService.getCameraMotionEvents(req.params.cameraId, limit);
    res.json({ success: true, events });
  } catch (error) {
     logger.error(`Error getting motion events for camera ${req.params.cameraId}`, 'Motion', error);
    res.status(500).json({ success: false, error: 'Failed to get motion events' });
  }
});

router.post('/:cameraId/simulate', requireAdmin, validateParams(cameraIdParamsSchema), (req: Request, res: Response) => {
  try {
    const streamManager = serviceRegistry.getStreamManager();
    const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.cameraId);
    if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
    streamManager.simulateMotionDetection(req.params.cameraId);
    res.json({ success: true, message: 'Motion simulation triggered' });
  } catch (error) {
     logger.error(`Error simulating motion for camera ${req.params.cameraId}`, 'Motion', error);
    res.status(500).json({ success: false, error: 'Failed to simulate motion' });
  }
});

router.post('/:cameraId/analyze', requireUser, validateParams(cameraIdParamsSchema), validateBody(analyzeBodySchema), async (req: Request, res: Response) => {
  try {
    const streamManager = serviceRegistry.getStreamManager();
    const cameraId = req.params.cameraId;
    const { enablePersonDetection, enableFaceDetection } = req.body;
    const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
    if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
    const currentFrame = streamManager.getCurrentFrame(cameraId);
    if (!currentFrame) { res.status(400).json({ success: false, error: 'No frame available from camera' }); return; }

    const analysisResults: any = { persons: [], faces: [], timestamp: new Date().toISOString() };
    if (enablePersonDetection) {
      try {
        const personResult = await consolidatedDetectionService.detectObjects(cameraId, currentFrame);
        analysisResults.persons = personResult.detections.filter((d: any) => d.class === 'person');
      } catch (error) {
        logger.warn(`Person detection unavailable: ${error}`, 'Motion');
      }
    }
    if (enableFaceDetection) {
      try {
        const faceResult = await consolidatedDetectionService.detectFaces(cameraId, currentFrame);
        analysisResults.faces = faceResult.faces;
      } catch (error) {
        logger.warn(`Face detection unavailable: ${error}`, 'Motion');
      }
    }

    const io: SocketIOServer = (req.app as any).get('io');
    io.emit('enhancedMotionDetected', {
      cameraId, timestamp: new Date().toISOString(),
      hasPersons: analysisResults.persons.length > 0,
      hasFaces: analysisResults.faces.length > 0,
      personCount: analysisResults.persons.length,
      faceCount: analysisResults.faces.length,
      knownFaces: analysisResults.faces.filter((f: any) => f.isKnown).length,
      unknownFaces: analysisResults.faces.filter((f: any) => !f.isKnown).length,
      analysis: analysisResults
    });
    res.json({ success: true, analysis: analysisResults });
  } catch (error) {
     logger.error(`Error analyzing motion for camera ${req.params.cameraId}`, 'Motion', error);
    res.status(500).json({ success: false, error: 'Failed to analyze motion' });
  }
});

export default router;
