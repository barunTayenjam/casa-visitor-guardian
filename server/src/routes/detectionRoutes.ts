import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { AppDataSource } from '../database.js';
import { Event } from '../models/Event.js';
import { DetectionConfig } from '../models/DetectionConfig.js';
import { Timeline } from '../models/Timeline.js';
import { AdaptiveRegion } from '../models/AdaptiveRegion.js';
import { TimelineService } from '../services/timeline/timelineService.js';
import { EnhancedDetectionService } from '../services/detection/enhancedDetectionService.js';

const router = Router();

router.use(rateLimitMiddleware('DETECTION'));

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

// Schema for detection queries
const DetectionQuerySchema = z.object({
  cameraId: z.string().optional(),
  eventType: z.string().optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
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

// Get detection events with enhanced filtering
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const validated = DetectionQuerySchema.safeParse({
      ...req.query,
      minConfidence: req.query.minConfidence ? parseFloat(req.query.minConfidence as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });

    if (!validated.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validated.error.errors,
      });
    }

    const query = validated.data;

    // Initialize repositories and services
    const eventRepo = AppDataSource.getRepository(Event);
    const configRepo = AppDataSource.getRepository(DetectionConfig);
    const timelineService = new TimelineService(
      AppDataSource.getRepository(Timeline),
      AppDataSource.getRepository(AdaptiveRegion)
    );
    const enhancedDetectionService = new EnhancedDetectionService(eventRepo, timelineService, configRepo);

    const result = await enhancedDetectionService.getDetections({
      cameraId: query.cameraId,
      eventType: query.eventType,
      after: query.after ? new Date(query.after) : undefined,
      before: query.before ? new Date(query.before) : undefined,
      minConfidence: query.minConfidence,
      limit: query.limit || 50,
      offset: query.offset || 0,
    });

    res.json({
      success: true,
      events: result.events,
      totalCount: result.totalCount,
      query,
    });
  } catch (error) {
    console.error('Get detection events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get detection events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get detection statistics
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.query;

    // Initialize repositories and services
    const eventRepo = AppDataSource.getRepository(Event);
    const configRepo = AppDataSource.getRepository(DetectionConfig);
    const timelineService = new TimelineService(
      AppDataSource.getRepository(Timeline),
      AppDataSource.getRepository(AdaptiveRegion)
    );
    const enhancedDetectionService = new EnhancedDetectionService(eventRepo, timelineService, configRepo);

    const stats = await enhancedDetectionService.getDetectionStats(
      typeof cameraId === 'string' ? cameraId : undefined
    );

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get detection stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get detection stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
