import { Router } from 'express';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { streamController } from '../controllers/StreamController.js';

const router = Router();

// MJPEG streams
router.get('/:cameraId/detect', requireUser, (req, res) => streamController.getDetectStream(req, res));
router.get('/:cameraId/live', optionalAuth, (req, res) => streamController.getLiveStream(req, res));
router.get('/:cameraId/frame', requireUser, (req, res) => streamController.getFrame(req, res));
router.get('/:cameraId/status', optionalAuth, (req, res) => streamController.getStreamStatus(req, res));

export default router;
