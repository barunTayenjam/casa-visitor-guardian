import { Express, Request, Response } from 'express';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { serviceRegistry } from '../services/serviceRegistry.js';

export function configureReviewTimelineRoutes(app: Express) {
  // Get review segments
  app.get('/api/review', optionalAuth, async (req: Request, res: Response) => {
    try {
      const reviewService = serviceRegistry.getReviewService();
      const { camera, after, before, severity, labels, limit, offset } = req.query;

      const result = await reviewService.getReviewSegments({
        camera: camera as string,
        after: after ? new Date(after as string) : undefined,
        before: before ? new Date(before as string) : undefined,
        severity: severity as 'alert' | 'detection',
        labels: labels ? (labels as string).split(',') : undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        return res.json({ success: true, data: { segments: [], total: 0, hasMore: false } });
      }
      console.error('Error fetching review segments:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch review segments' });
    }
  });

  // Get review segment by ID
  app.get('/api/review/:id', optionalAuth, async (req: Request, res: Response) => {
    try {
      const reviewService = serviceRegistry.getReviewService();
      const segment = await reviewService.getReviewSegment(req.params.id);
      if (!segment) {
        return res.status(404).json({ success: false, error: 'Segment not found' });
      }
      res.json({ success: true, data: segment });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        return res.status(503).json({ success: false, error: 'Review service not available' });
      }
      console.error('Error fetching review segment:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch review segment' });
    }
  });

  // Acknowledge review segment
  app.post('/api/review/:id/acknowledge', requireUser, async (req: Request, res: Response) => {
    try {
      const reviewService = serviceRegistry.getReviewService();
      const { userId = 'anonymous', action } = req.body;
      await reviewService.acknowledgeSegment(req.params.id, userId, action);
      res.json({ success: true });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        return res.status(503).json({ success: false, error: 'Review service not available' });
      }
      console.error('Error acknowledging segment:', error);
      res.status(500).json({ success: false, error: 'Failed to acknowledge segment' });
    }
  });

  // Get timeline
  app.get('/api/timeline', optionalAuth, async (req: Request, res: Response) => {
    try {
      const timelineService = serviceRegistry.getTimelineService();
      const { camera, after, before, sources, limit } = req.query;

      const result = await timelineService.getTimeline({
        camera: camera as string,
        after: after ? new Date(after as string) : undefined,
        before: before ? new Date(before as string) : undefined,
        sources: sources ? (sources as string).split(',') : undefined,
        limit: limit ? parseInt(limit as string) : 1000,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        return res.json({ success: true, data: { events: [], summary: {} } });
      }
      console.error('Error fetching timeline:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
    }
  });

  // Get active objects for a camera
  app.get('/api/timeline/active/:camera', optionalAuth, async (req: Request, res: Response) => {
    try {
      const timelineService = serviceRegistry.getTimelineService();
      const activeObjects = await timelineService.getActiveObjects(req.params.camera);
      const result: Record<string, { label: string; lastSeen: string; score: number }> = {};
      for (const [id, obj] of activeObjects.entries()) {
        result[id] = { ...obj, lastSeen: obj.lastSeen.toISOString() };
      }
      res.json({ success: true, data: result });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        return res.json({ success: true, data: {} });
      }
      console.error('Error fetching active objects:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch active objects' });
    }
  });
}
