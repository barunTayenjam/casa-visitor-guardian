import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { streamManager } from '../streams/rtspManager.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
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

router.get('/motion/settings', optionalAuth, async (req: Request, res: Response) => {
  try {
    const motionDetector = serviceRegistry.getMotionDetector();
    const { cameraId } = req.query;
    if (cameraId && typeof cameraId === 'string') {
      const settings = motionDetector.getSettings(cameraId);
      if (!settings) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
      res.json({ success: true, settings, cameraId }); return;
    }
    const allCameras = serviceRegistry.getStreamManager().getAllCameras();
    const allSettings: Record<string, any> = {};
    allCameras.forEach((camera: any) => { allSettings[camera.id] = motionDetector.getSettings(camera.id); });
    res.json({ success: true, settings: allSettings });
  } catch (error) {
    console.error('Error getting motion detection settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get motion detection settings' });
  }
});

router.put('/motion/settings', requireUser, async (req: Request, res: Response) => {
  try {
    const motionDetector = serviceRegistry.getMotionDetector();
    const { cameraId, sensitivity, requiredConsecutiveFrames, minContourArea, useGaussianBlur, blurKernelSize, timeZones } = req.body;
    if (!cameraId) { res.status(400).json({ success: false, error: 'cameraId is required' }); return; }
    const updates: any = {};
    if (sensitivity !== undefined) updates.sensitivity = sensitivity;
    if (requiredConsecutiveFrames !== undefined) updates.requiredConsecutiveFrames = requiredConsecutiveFrames;
    if (minContourArea !== undefined) updates.minContourArea = minContourArea;
    if (useGaussianBlur !== undefined) updates.useGaussianBlur = useGaussianBlur;
    if (blurKernelSize !== undefined) updates.blurKernelSize = blurKernelSize;
    if (timeZones !== undefined) updates.timeZones = timeZones;
    const updated = motionDetector.updateSettings(cameraId, updates);
    if (updated) res.json({ success: true, updated, cameraId });
    else res.status(404).json({ success: false, error: 'Camera not found or update failed' });
  } catch (error) {
    console.error('Error updating motion detection settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update motion detection settings' });
  }
});

router.get('/face/persons', optionalAuth, async (_req: Request, res: Response) => {
  try {
    res.status(501).json({ success: false, error: 'Not implemented - use /api/detection/persons instead', code: 'NOT_IMPLEMENTED' });
  } catch (error) {
    console.error('Error getting known persons:', error);
    res.status(500).json({ success: false, error: 'Failed to get known persons' });
  }
});

router.post('/face/persons', requireUser, async (_req: Request, res: Response) => {
  try {
    res.status(501).json({ success: false, error: 'Not implemented - use /api/detection/persons instead', code: 'NOT_IMPLEMENTED' });
  } catch (error: any) {
    console.error('Error adding known person:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to add known person' });
  }
});

router.get('/persons', optionalAuth, async (req: Request, res: Response) => {
  try {
    const persons = await visitorService.getKnownPersons();
    res.json({ success: true, persons });
  } catch (error) {
    console.error('Error getting known persons:', error);
    res.status(500).json({ success: false, error: 'Failed to get known persons' });
  }
});

router.post('/persons', requireUser, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) { res.status(400).json({ success: false, error: 'Name is required' }); return; }
    const personId = await visitorService.createPerson(name);
    res.json({ success: true, personId, message: `Person ${name} added successfully` });
  } catch (error: any) {
    console.error('Error adding known person:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to add known person' });
  }
});

router.get('/faces', optionalAuth, async (req: Request, res: Response) => {
  try {
    const faces = await visitorService.getKnownFaces();
    res.json({ success: true, faces });
  } catch (error) {
    console.error('Error getting known faces:', error);
    res.status(500).json({ success: false, error: 'Failed to get known faces' });
  }
});

router.delete('/faces/:personId', requireUser, async (req: Request, res: Response) => {
  try {
    const deleted = await visitorService.deleteFace(req.params.personId);
    if (!deleted) { res.status(404).json({ success: false, error: 'Face not found' }); return; }
    res.json({ success: true, message: 'Face deleted successfully' });
  } catch (error) {
    console.error('Error deleting known face:', error);
    res.status(500).json({ success: false, error: 'Failed to delete known face' });
  }
});

router.post('/faces/retrain', requireUser, async (req: Request, res: Response) => {
  try {
    const opencvUrl = process.env.OPENCV_SERVICE_URL || 'http://localhost:8084';
    const response = await fetch(`${opencvUrl}/retrain`, { method: 'POST' });
    const result = await response.json();
    res.json({ success: true, message: 'Face model retrained successfully', trainingTime: result.training_time || 0 });
  } catch (error) {
    console.error('Error retraining face model:', error);
    res.status(500).json({ success: false, error: 'Failed to retrain face model' });
  }
});

router.post('/faces/register', requireUser, async (req: Request, res: Response) => {
  try {
    const { name, imageData } = req.body;
    if (!name || !imageData) { res.status(400).json({ success: false, error: 'Name and imageData are required' }); return; }
    const personId = await visitorService.registerFace(name);
    res.json({ success: true, personId, message: `Face registered for ${name}` });
  } catch (error) {
    console.error('Error registering face:', error);
    res.status(500).json({ success: false, error: 'Failed to register face' });
  }
});

router.get('/events', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const result = await eventSearchService.getDetectionEvents({
      limit,
      type: req.query.type as string,
      cameraId: req.query.cameraId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting detection events:', error);
    res.status(500).json({ success: false, error: 'Failed to get detection events' });
  }
});

router.get('/opencv/status', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { getOpenCVClient } = await import('../services/opencvMicroserviceClient.js');
    const client = getOpenCVClient();
    const status = await client.getStatus();
    const isHealthy = await client.checkHealth();
    res.json({ success: true, status: status || { status: 'error', initialized: false, service: 'opencv-detection' }, healthy: isHealthy, serviceUrl: client.getServiceUrl() });
  } catch (error) {
    console.error('Error getting OpenCV service status:', error);
    res.status(500).json({ success: false, error: 'Failed to get OpenCV service status', status: { status: 'error', initialized: false, service: 'opencv-detection' } });
  }
});

export default router;
