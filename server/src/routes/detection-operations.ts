import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { streamManager } from '../streams/rtspManager.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { inMemoryState } from '../services/inMemoryStateService.js';
import eventSearchService from '../services/eventSearchService.js';
import visitorService from '../services/visitorService.js';
import { optionalAuth, requireUser, requireAdmin } from '../middleware/auth.js';

const CAMERA_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
function validateCameraId(cameraId: string): boolean { return CAMERA_ID_PATTERN.test(cameraId) && cameraId.length <= 100; }

const router = Router();

router.post('/person/:cameraId/trigger', requireUser, async (req: Request, res: Response) => {
  try {
    const cameraId = req.params.cameraId;
    if (!cameraId || !validateCameraId(cameraId)) { res.status(400).json({ success: false, error: 'Invalid camera ID format' }); return; }
    const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
    if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
    if (!camera.isActive) { res.status(400).json({ success: false, error: 'Camera is not active' }); return; }
    const currentFrame = streamManager.getCurrentFrame(cameraId);
    if (!currentFrame) { res.status(400).json({ success: false, error: 'No frame available from camera' }); return; }
    const { detections } = await consolidatedDetectionService.detectObjects(cameraId, currentFrame);
    const persons = detections.filter((d: any) => d.class === 'person') || [];
    if (persons.length > 0) {
      const io: SocketIOServer = (req as any).app.get('io');
      io.emit('personDetected', { cameraId, timestamp: new Date().toISOString(), persons: persons.map((p: any) => ({ confidence: p.confidence, boundingBox: p.bbox, timestamp: new Date().toISOString() })), imagePath: currentFrame });
      inMemoryState.addAlert({ type: 'motion', severity: 'warning', message: `Person detected on camera ${camera.name || cameraId}`, cameraId });
    }
    res.json({ success: true, persons: persons.length, detections: detections || [], timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(`Error triggering person detection for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to trigger person detection' });
  }
});

router.post('/face/:cameraId/trigger', requireUser, async (req: Request, res: Response) => {
  try {
    const cameraId = req.params.cameraId;
    const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
    if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
    if (!camera.isActive) { res.status(400).json({ success: false, error: 'Camera is not active' }); return; }
    const currentFrame = streamManager.getCurrentFrame(cameraId);
    if (!currentFrame) { res.status(400).json({ success: false, error: 'No frame available from camera' }); return; }
    const { faces } = await consolidatedDetectionService.detectFaces(cameraId, currentFrame);
    if (faces && faces.length > 0) {
      const io: SocketIOServer = (req as any).app.get('io');
      io.emit('faceDetected', { cameraId, timestamp: new Date().toISOString(), faces: faces.map((f: any) => ({ confidence: f.confidence, boundingBox: f.bbox, personId: f.id, personName: f.name, isKnown: f.name !== 'Unknown', timestamp: new Date().toISOString() })), imagePath: currentFrame });
      const unknownFaces = faces.filter((f: any) => f.name === 'Unknown');
      if (unknownFaces.length > 0) inMemoryState.addAlert({ type: 'motion', severity: 'warning', message: `Unknown face detected on camera ${camera.name || cameraId}`, cameraId });
    }
    res.json({ success: true, faces: faces?.length || 0, knownFaces: faces?.filter((f: any) => f.name !== 'Unknown').length || 0, unknownFaces: faces?.filter((f: any) => f.name === 'Unknown').length || 0, detections: faces || [], timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(`Error triggering face detection for camera ${req.params.cameraId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to trigger face detection' });
  }
});

router.get('/person/settings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const cameraId = (req.query.camera as string) || 'default';
    const settings = consolidatedDetectionService.getObjectDetectionSettings(cameraId);
    res.json({ success: true, settings: settings || {} });
  } catch (error) {
    console.error('Error getting person detection settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get person detection settings' });
  }
});

router.put('/person/settings', requireUser, async (req: Request, res: Response) => {
  try {
    const { minConfidence, maxDetections, targetClasses } = req.body;
    const updated = consolidatedDetectionService.updateObjectDetectionSettings('default', { minConfidence: minConfidence || 0.5, maxDetections: maxDetections || 10, targetClasses: targetClasses || ['person', 'dog', 'cat'] });
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating person detection settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update person detection settings' });
  }
});

router.get('/face/settings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const settings = consolidatedDetectionService.getFacialRecognitionSettings();
    res.json({ success: true, settings: settings || {} });
  } catch (error) {
    console.error('Error getting facial recognition settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get facial recognition settings' });
  }
});

router.put('/face/settings', requireUser, async (req: Request, res: Response) => {
  try {
    const { recognitionThreshold, minFaceSize } = req.body;
    const updated = consolidatedDetectionService.updateFacialRecognitionSettings({ recognitionThreshold: recognitionThreshold || 0.6, minFaceSize: minFaceSize || 48 });
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating facial recognition settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update facial recognition settings' });
  }
});

export default router;
