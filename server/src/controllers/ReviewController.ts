import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import { serviceRegistry } from '../services/serviceRegistry.js';

export class ReviewController extends BaseController {
  async getSegments(req: Request, res: Response): Promise<void> {
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

      this.ok(res, { data: result });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        res.json({ success: true, data: { segments: [], total: 0, hasMore: false } });
        return;
      }
      this.serverError(res, error, 'getSegments');
    }
  }

  async getSegmentById(req: Request, res: Response): Promise<void> {
    try {
      const reviewService = serviceRegistry.getReviewService();
      const segment = await reviewService.getReviewSegment(req.params.id);
      if (!segment) { this.notFound(res, 'Segment not found'); return; }
      this.ok(res, { data: segment });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        res.status(503).json({ success: false, error: 'Review service not available' });
        return;
      }
      this.serverError(res, error, 'getSegmentById');
    }
  }

  async acknowledgeSegment(req: Request, res: Response): Promise<void> {
    try {
      const reviewService = serviceRegistry.getReviewService();
      const { userId = 'anonymous', action } = req.body;
      await reviewService.acknowledgeSegment(req.params.id, userId, action);
      this.ok(res, {});
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        res.status(503).json({ success: false, error: 'Review service not available' });
        return;
      }
      this.serverError(res, error, 'acknowledgeSegment');
    }
  }

  async getTimeline(req: Request, res: Response): Promise<void> {
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

      this.ok(res, { data: result });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        res.json({ success: true, data: { events: [], summary: {} } });
        return;
      }
      this.serverError(res, error, 'getTimeline');
    }
  }

  async getActiveObjects(req: Request, res: Response): Promise<void> {
    try {
      const timelineService = serviceRegistry.getTimelineService();
      const activeObjects = await timelineService.getActiveObjects(req.params.camera);
      const result: Record<string, any> = {};
      for (const [id, obj] of activeObjects.entries()) {
        result[id] = { ...obj, lastSeen: obj.lastSeen.toISOString() };
      }
      this.ok(res, { data: result });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        res.json({ success: true, data: {} });
        return;
      }
      this.serverError(res, error, 'getActiveObjects');
    }
  }
}

export const reviewController = new ReviewController();
