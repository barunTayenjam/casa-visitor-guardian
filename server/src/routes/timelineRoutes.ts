import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { timelineService } from '../services/timeline/timelineService.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';

const router = Router();

const TimelineQuerySchema = z.object({
  camera: z.string().optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  sources: z.string().optional(),
  limit: z.coerce.number().min(1).max(10000).default(1000),
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const query = TimelineQuerySchema.parse(req.query);
    const result = await timelineService.getTimeline({
      ...query,
      after: query.after ? new Date(query.after) : undefined,
      before: query.before ? new Date(query.before) : undefined,
      sources: query.sources ? query.sources.split(',') : undefined,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Get timeline error:', err);
    res.status(500).json({ success: false, error: 'Failed to get timeline' });
  }
});

router.get('/active/:camera', authenticate, async (req: Request, res: Response) => {
  try {
    const activeObjects = await timelineService.getActiveObjects(req.params.camera);
    const objects = Array.from(activeObjects.entries()).map(([id, obj]) => ({
      id,
      label: obj.label,
      lastSeen: obj.lastSeen.toISOString(),
      score: obj.score,
    }));

    res.json({ success: true, data: { objects, count: objects.length } });
  } catch (err) {
    console.error('Get active objects error:', err);
    res.status(500).json({ success: false, error: 'Failed to get active objects' });
  }
});

router.get('/regions/:camera', authenticate, async (req: Request, res: Response) => {
  try {
    const regions = await timelineService.getAdaptiveRegions(req.params.camera);
    res.json({ success: true, data: regions });
  } catch (err) {
    console.error('Get adaptive regions error:', err);
    res.status(500).json({ success: false, error: 'Failed to get adaptive regions' });
  }
});

router.delete('/regions/:camera', authenticate, async (req: Request, res: Response) => {
  try {
    await timelineService.clearAdaptiveRegions(req.params.camera);
    res.json({ success: true, message: 'Adaptive regions cleared' });
  } catch (err) {
    console.error('Clear adaptive regions error:', err);
    res.status(500).json({ success: false, error: 'Failed to clear adaptive regions' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const result = await timelineService.addTimelineEvent(event);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Add timeline event error:', err);
    res.status(500).json({ success: false, error: 'Failed to add timeline event' });
  }
});

export default router;
