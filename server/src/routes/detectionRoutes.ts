import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';

const router = Router();

const ThresholdSchema = z.object({
  min_score: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
});

const DetectionConfigSchema = z.object({
  thresholds: z.record(z.string(), ThresholdSchema).optional(),
  labelmap: z.record(z.string(), z.string()).optional(),
  score_history_length: z.number().min(1).max(20).optional(),
});

const CameraDetectionConfigSchema = DetectionConfigSchema.extend({
  camera: z.string(),
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const camera = typeof req.query.camera === 'string' ? req.query.camera : undefined;
    const globalConfig = await import('../services/detection/detectionService.js').then(m => m.detectionService?.getConfig(camera));

    const config = globalConfig || {
      thresholds: {
        person: { min_score: 0.3, threshold: 0.5 },
        car: { min_score: 0.4, threshold: 0.6 },
        dog: { min_score: 0.3, threshold: 0.4 },
        package: { min_score: 0.25, threshold: 0.35 },
      },
      labelmap: {
        truck: 'car',
        bus: 'car',
        motorcycle: 'car',
      },
      score_history_length: 7,
    };

    res.json({ success: true, data: config });
  } catch (err) {
    console.error('Get detection config error:', err);
    res.status(500).json({ success: false, error: 'Failed to get detection config' });
  }
});

router.put('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const camera = typeof req.query.camera === 'string' ? req.query.camera : null;
    const parsed = CameraDetectionConfigSchema.parse(req.body);

    await import('../services/detection/detectionService.js').then(m => m.detectionService?.updateConfig(camera, parsed));

    res.json({ success: true, message: 'Detection configuration updated' });
  } catch (err) {
    console.error('Update detection config error:', err);
    res.status(500).json({ success: false, error: 'Failed to update detection config' });
  }
});

router.post('/filter', authenticate, async (req: Request, res: Response) => {
  try {
    const { detections, camera } = req.body;

    if (!Array.isArray(detections)) {
      return res.status(400).json({ success: false, error: 'Detections must be an array' });
    }

    const config = await import('../services/detection/detectionService.js').then(m => m.detectionService?.getConfig(camera));

    const filtered = await import('../services/detection/detectionService.js').then(m =>
      m.detectionService?.filterDetections(detections, camera)
    );

    res.json({ success: true, data: { filtered, config } });
  } catch (err) {
    console.error('Filter detections error:', err);
    res.status(500).json({ success: false, error: 'Failed to filter detections' });
  }
});

export default router;
