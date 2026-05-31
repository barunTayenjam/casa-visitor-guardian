import { Router } from 'express';
import { validate, commonSchemas } from '../middleware/validation.js';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { cameraController } from '../controllers/CameraController.js';

const router = Router();

router.get('/', optionalAuth, (req, res) => cameraController.listAll(req, res));
router.get('/:id', optionalAuth, (req, res) => cameraController.getById(req, res));
router.post('/', requireUser, validate(commonSchemas.createCamera), (req, res) => cameraController.create(req, res));
router.put('/:id', requireUser, (req, res) => cameraController.update(req, res));
router.delete('/:id', requireUser, (req, res) => cameraController.remove(req, res));

router.post('/:id/stream/start-test', requireUser, (req, res) => cameraController.startTestStream(req, res));
router.post('/:id/stream/stop-test', requireUser, (req, res) => cameraController.stopTestStream(req, res));
router.post('/:id/stream/start', requireUser, (req, res) => cameraController.startStream(req, res));
router.post('/:id/stream/stop', requireUser, (req, res) => cameraController.stopStream(req, res));
router.post('/:id/snapshot', requireUser, (req, res) => cameraController.takeSnapshot(req, res));
router.post('/:id/night-mode', requireUser, (req, res) => cameraController.toggleNightMode(req, res));

router.get('/:cameraId/zones', optionalAuth, (req, res) => cameraController.getZones(req, res));
router.post('/:cameraId/zones', requireUser, (req, res) => cameraController.addZone(req, res));
router.put('/:cameraId/zones/:zoneId', requireUser, (req, res) => cameraController.updateZone(req, res));
router.delete('/:cameraId/zones/:zoneId', requireUser, (req, res) => cameraController.deleteZone(req, res));

router.get('/:cameraId/filters', optionalAuth, (req, res) => cameraController.getFilters(req, res));
router.put('/:cameraId/filters/track', requireUser, (req, res) => cameraController.updateTrackList(req, res));
router.put('/:cameraId/filters/:label', requireUser, (req, res) => cameraController.updateFilter(req, res));
router.delete('/:cameraId/filters/:label', requireUser, (req, res) => cameraController.deleteFilter(req, res));

export default router;
