import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../middleware/zodValidation.js';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { cameraController } from '../controllers/CameraController.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid camera ID format').max(100),
});

const zoneParamsSchema = z.object({
  cameraId: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid camera ID format').max(100),
  zoneId: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid zone ID format').max(100),
});

const filterParamsSchema = z.object({
  cameraId: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid camera ID format').max(100),
  label: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid filter label format').max(100),
});

const createCameraSchema = z.object({
  name: z.string().min(1).max(100),
  rtspUrl: z
    .string()
    .refine(
      (v) => v.startsWith('rtsp://') || v.startsWith('rtsps://'),
      'RTSP URL must start with rtsp:// or rtsps://',
    ),
  username: z.string().max(100).optional(),
  password: z.string().max(100).optional(),
  frameRate: z.number().int().min(1).max(60).optional(),
  resolution: z
    .string()
    .regex(/^\d+x\d+$/, 'Resolution must be WIDTHxHEIGHT')
    .optional(),
  nightMode: z.boolean().optional(),
});

router.get('/', optionalAuth, (req, res) => cameraController.listAll(req, res));
router.get('/:id', optionalAuth, (req, res) => cameraController.getById(req, res));
router.post('/', requireUser, validateBody(createCameraSchema), (req, res) =>
  cameraController.create(req, res),
);
router.put('/:id', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.update(req, res),
);
router.delete('/:id', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.remove(req, res),
);

router.post('/:id/stream/start-test', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.startTestStream(req, res),
);
router.post('/:id/stream/stop-test', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.stopTestStream(req, res),
);
router.post('/:id/stream/start', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.startStream(req, res),
);
router.post('/:id/stream/stop', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.stopStream(req, res),
);
router.post('/:id/snapshot', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.takeSnapshot(req, res),
);
router.post('/:id/night-mode', requireUser, validateParams(idParamSchema), (req, res) =>
  cameraController.toggleNightMode(req, res),
);

router.get('/:cameraId/zones', optionalAuth, (req, res) => cameraController.getZones(req, res));
router.post('/:cameraId/zones', requireUser, (req, res) => cameraController.addZone(req, res));
router.put('/:cameraId/zones/:zoneId', requireUser, validateParams(zoneParamsSchema), (req, res) =>
  cameraController.updateZone(req, res),
);
router.delete(
  '/:cameraId/zones/:zoneId',
  requireUser,
  validateParams(zoneParamsSchema),
  (req, res) => cameraController.deleteZone(req, res),
);

router.get('/:cameraId/filters', optionalAuth, (req, res) => cameraController.getFilters(req, res));
router.put('/:cameraId/filters/track', requireUser, (req, res) =>
  cameraController.updateTrackList(req, res),
);
router.put('/:cameraId/filters/:label', requireUser, validateParams(filterParamsSchema), (req, res) =>
  cameraController.updateFilter(req, res),
);
router.delete(
  '/:cameraId/filters/:label',
  requireUser,
  validateParams(filterParamsSchema),
  (req, res) => cameraController.deleteFilter(req, res),
);

export default router;
