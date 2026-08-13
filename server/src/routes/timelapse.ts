import { Router, Request, Response } from 'express';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { TimelapseService } from '../services/timelapse/timelapseService.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { logger } from '../utils/logger.js';
import path from 'node:path';

const router = Router();

let timelapseService: TimelapseService | null = null;

export function setTimelapseService(service: TimelapseService) {
  timelapseService = service;
}

// GET /api/timelapse/list/:date — list cameras with timelapse for a date
router.get('/list/:date', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
    }
    if (!timelapseService)
      return res.status(503).json({ success: false, error: 'Timelapse service not ready' });
    const list = await timelapseService.listTimelapsesForDate(date);
    res.json({ success: true, date, timelapses: list });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /api/timelapse/:cameraId/:date — serve the MP4
router.get('/:cameraId/:date', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { cameraId, date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cameraId)) {
      return res.status(400).json({ success: false, error: 'Invalid camera ID' });
    }
    if (!timelapseService)
      return res.status(503).json({ success: false, error: 'Timelapse service not ready' });
    const has = await timelapseService.hasTimelapse(cameraId, date);
    if (!has) return res.status(404).json({ success: false, error: 'Timelapse not found' });

    const finalPath = path.join(
      process.env.TIMELAPSE_DIR || path.join(process.cwd(), 'public', 'timelapse'),
      cameraId,
      `${date}.mp4`,
    );
    res.set('Content-Type', 'video/mp4');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(finalPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/timelapse/generate/:cameraId/:date — backfill a past date's timelapse from detection snapshots
router.post('/generate/:cameraId/:date', requireUser, async (req: Request, res: Response) => {
  try {
    const { cameraId, date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cameraId)) {
      return res.status(400).json({ success: false, error: 'Invalid camera ID' });
    }
    if (!timelapseService)
      return res.status(503).json({ success: false, error: 'Timelapse service not ready' });

    const today = new Date().toISOString().split('T')[0];
    if (date >= today) {
      return res
        .status(400)
        .json({
          success: false,
          error: 'Backfill only available for past dates. Use the live capture for today.',
        });
    }

    const result = await timelapseService.generateForDate(cameraId, date, async (sql, params) => {
      const ds = serviceRegistry.getAppDataSource();
      return ds.query(sql, params as never) as Promise<Array<{ file_path: string }>>;
    });

    res.json({
      success: true,
      message:
        result.source === 'raw'
          ? `Generated timelapse from ${result.count} captured frames (live samples); cleaned ${result.deleted ?? 0} raws`
          : `Generated timelapse from ${result.count} detection snapshots (skipped ${result.skipped ?? 0} missing)`,
      cameraId,
      date,
      source: result.source,
      path: `/timelapse/${cameraId}/${date}.mp4`,
      frames: result.count,
      skipped: result.skipped ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      `Backfill failed for ${req.params.cameraId}/${req.params.date}: ${msg}`,
      'TimelapseRoutes',
    );
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
