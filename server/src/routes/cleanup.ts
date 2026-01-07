import { Router } from 'express';
import { databaseCleanupService } from '../services/databaseCleanupService.js';

export function configureCleanupRoutes(router: Router): void {
  router.post('/cleanup/trigger', async (req, res) => {
    try {
      const result = await databaseCleanupService.manualCleanup();
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Manual cleanup error:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  router.get('/cleanup/stats', async (req, res) => {
    try {
      const result = await databaseCleanupService.manualCleanup();
      res.json({
        success: true,
        lastRun: new Date().toISOString(),
        ...result
      });
    } catch (error) {
      console.error('Cleanup stats error:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
}
