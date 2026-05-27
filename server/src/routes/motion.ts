import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { streamManager } from '../streams/rtspManager.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { inMemoryState } from '../services/inMemoryStateService.js';
import eventSearchService from '../services/eventSearchService.js';
import { optionalAuth, requireUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/events', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const events = await eventSearchService.getMotionEvents(limit);
    res.json({ success: true, events });
  } catch (error) {
    console.error('Error getting motion events:', error);
    res.status(500).json({ success: false, error: 'Failed to get motion events' });
  }
});

router.get('/:cameraId/events', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 1000);
    const events = await eventSearchService.getCameraMotionEvents(req.params.cameraId, limit);
    res.json({ success: true, events });
  } catch (error) {
    console.error(`Error getting motion events for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get motion events' });
  }
});

router.get('/:cameraId/settings', optionalAuth, (req: Request, res: Response) => {
  try {
    const motionDetector = serviceRegistry.getMotionDetector();
    const settings = motionDetector.getSettings(req.params.cameraId);
    if (!settings) { res.status(404).json({ success: false, error: 'Settings not found' }); return; }
    res.json({ success: true, settings });
  } catch (error) {
    console.error(`Error getting motion settings for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get motion settings' });
  }
});

router.put('/:cameraId/settings', requireUser, (req: Request, res: Response) => {
  try {
    const { enabled, sensitivity, cooldownPeriod } = req.body;
    const motionDetector = serviceRegistry.getMotionDetector();
    const updated = motionDetector.updateSettings(req.params.cameraId, { enabled, sensitivity, cooldownPeriod });
    if (!updated) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error(`Error updating motion settings for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to update motion settings' });
  }
});

router.post('/:cameraId/simulate', requireAdmin, (req: Request, res: Response) => {
  try {
    const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.cameraId);
    if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
    streamManager.simulateMotionDetection(req.params.cameraId);
    res.json({ success: true, message: 'Motion simulation triggered' });
  } catch (error) {
    console.error(`Error simulating motion for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to simulate motion' });
  }
});

router.post('/:cameraId/analyze', requireUser, async (req: Request, res: Response) => {
  try {
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

    const io: SocketIOServer = (req as any).app.get('io');
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
    console.error(`Error analyzing motion for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to analyze motion' });
  }
});

export default router;
