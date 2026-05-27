import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import eventSearchService from '../services/eventSearchService.js';

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

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.query as Record<string, string>;
      const result = await eventSearchService.getHistory(filters);
      this.ok(res, {
        events: result.events,
        pagination: result.pagination,
      });
    } catch (error) {
      this.serverError(res, error, 'getHistory');
    }
  }
}

export const eventController = new EventController();
