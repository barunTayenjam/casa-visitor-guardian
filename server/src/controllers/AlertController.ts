import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import { inMemoryState } from '../services/inMemoryStateService.js';

export class AlertController extends BaseController {
  getAll(req: Request, res: Response): void {
    try {
      this.ok(res, { alerts: inMemoryState.getAlerts() });
    } catch (error) {
      this.serverError(res, error, 'getAll alerts');
    }
  }

  async acknowledge(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await inMemoryState.acknowledgeAlert(id);
      if (!result) {
        this.notFound(res, 'Alert not found');
        return;
      }
      this.ok(res, { message: 'Alert acknowledged' });
    } catch (error) {
      this.serverError(res, error, 'acknowledgeAlert');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await inMemoryState.deleteAlert(id);
      if (!result) {
        this.notFound(res, 'Alert not found');
        return;
      }
      this.ok(res, { message: 'Alert deleted' });
    } catch (error) {
      this.serverError(res, error, 'deleteAlert');
    }
  }
}

export const alertController = new AlertController();
