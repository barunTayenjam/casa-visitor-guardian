import { logger } from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { inMemoryState } from '../services/inMemoryStateService.js';
import eventSearchService from '../services/eventSearchService.js';
import { optionalAuth, requireUser, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();

router.get('/events', optionalAuth, validate({
  query: {
    limit: { type: 'number' as const, required: false, min: 1, max: 1000 }
  }
}), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const events = await eventSearchService.getMotionEvents(limit);
    res.json({ success: true, events });
  } catch (error) {
     logger.error('Error getting motion events', 'Motion', error);
    res.status(500).json({ success: false, error: 'Failed to get motion events' });
  }
});

router.get('/:cameraId/events', optionalAuth, validate({
  params: {
    cameraId: { type: 'string' as const, required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
  },
  query: {
    limit: { type: 'number' as const, required: false, min: 1, max: 1000 }
  }
}), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 1000);
    const events = await eventSearchService.getCameraMotionEvents(req.params.cameraId, limit);
    res.json({ success: true, events });
  } catch (error) {
     logger.error(`Error getting motion events for camera ${req.params.cameraId}`, 'Motion', error);
    res.status(500).json({ success: false, error: 'Failed to get motion events' });
  }
});

router.post('/:cameraId/simulate', requireAdmin, validate({
  params: {
    cameraId: { type: 'string' as const, required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
  }
}), (req: Request, res: Response) => {
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

router.post('/:cameraId/analyze', requireUser, validate({
  params: {
    cameraId: { type: 'string' as const, required: true, pattern: /^[a-zA-Z0-9_-]+$/ }
  },
  body: {
    enablePersonDetection: { type: 'boolean' as const, required: false },
    enableFaceDetection: { type: 'boolean' as const, required: false }
  }
}), async (req: Request, res: Response) => {
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
      const personResult = await consolidatedDetectionService.detectObjects(cameraId, currentFrame);
      analysisResults.persons = personResult.detections.filter((d: any) => d.class === 'person');
    }
    if (enableFaceDetection) {
      const faceResult = await consolidatedDetectionService.detectFaces(cameraId, currentFrame);
      analysisResults.faces = faceResult.faces;
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
