import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import eventSearchService from '../services/eventSearchService.js';
import { relationAnalysisService } from '../services/relationAnalysisService.js';
import { relationThreatService } from '../services/relationThreatService.js';

export class EventController extends BaseController {
  async listEnhanced(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query as Record<string, string>;
      const result = await eventSearchService.listEnhanced(filters);
      this.ok(res, {
        events: result.events,
        pagination: result.pagination,
      });
    } catch (error) {
      this.serverError(res, error, 'listEnhanced');
    }
  }

  async getEventRelations(req: Request, res: Response): Promise<void> {
    try {
      const result = await relationAnalysisService.getEventRelations(req.params.id);
      if (!result) {
        this.notFound(res, 'Event not found');
        return;
      }
      this.ok(res, result as unknown as Record<string, unknown>);
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid event id') {
        this.badRequest(res, error.message);
        return;
      }
      this.serverError(res, error, 'getEventRelations');
    }
  }

  async getEventRelationThreat(req: Request, res: Response): Promise<void> {
    try {
      const result = await relationThreatService.assessEventThreat(req.params.id);
      if (!result) {
        this.notFound(res, 'Event not found');
        return;
      }
      this.ok(res, result as unknown as Record<string, unknown>);
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid event id') {
        this.badRequest(res, error.message);
        return;
      }
      this.serverError(res, error, 'getEventRelationThreat');
    }
  }
}

export const eventController = new EventController();
