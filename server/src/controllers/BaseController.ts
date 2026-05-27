import { Response } from 'express';
import { logger } from '../utils/logger.js';

export class BaseController {
  protected ok(res: Response, data: Record<string, unknown>): void {
    res.json({ success: true, ...data });
  }

  protected created(res: Response, data: Record<string, unknown>): void {
    res.status(201).json({ success: true, ...data });
  }

  protected badRequest(res: Response, error: string): void {
    res.status(400).json({ success: false, error });
  }

  protected notFound(res: Response, error: string = 'Not found'): void {
    res.status(404).json({ success: false, error });
  }

  protected serverError(res: Response, error: unknown, context?: string): void {
    logger.error(`Error${context ? ` [${context}]` : ''}: ${error}`, 'Controller');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
