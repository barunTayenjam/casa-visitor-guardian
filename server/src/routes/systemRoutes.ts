import { Express, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { optionalAuth, requireUser, requireAdmin } from '../middleware/auth.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { inMemoryState, MotionEvent } from '../services/inMemoryStateService.js';
import { storageStatsService } from '../services/storageStatsService.js';
import { AutomatedCleanupService } from '../services/automatedCleanupService.js';
import type { Camera } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function configureSystemRoutes(app: Express) {
  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const cameras = streamManager.getAllCameras();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeCameras: cameras.filter((c: any) => c.isActive).length
      });
    } catch (error) {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeCameras: 0
      });
    }
  });

  // Image cleanup endpoint
  app.post('/api/maintenance/cleanup-images', requireAdmin, async (req: Request, res: Response) => {
    try {
      const retentionDays = parseInt(req.body.retentionDays) || 7;
      if (retentionDays < 1 || retentionDays > 365) {
        return res.status(400).json({ success: false, error: 'Retention days must be between 1 and 365' });
      }

      console.log(`Admin triggered image cleanup with ${retentionDays} days retention`);
      const cleanupService = AutomatedCleanupService.getInstance();
      const result = await cleanupService.cleanupOldImages(retentionDays);

      res.json({
        success: true,
        message: 'Cleanup complete',
        retentionDays,
        deleted: result.deleted,
        preserved: result.preserved,
        freedBytes: result.freedBytes,
        freedMB: (result.freedBytes / 1024 / 1024).toFixed(2)
      });
    } catch (error: any) {
      console.error('Image cleanup error:', error);
      res.status(500).json({ success: false, error: error.message || 'Cleanup failed' });
    }
  });

  // Get cleanup status
  app.get('/api/maintenance/cleanup-status', requireAdmin, async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        message: 'Use POST /api/maintenance/cleanup-images to run cleanup'
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // System overview endpoint
  app.get('/api/system/overview', requireUser, async (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const cameras = streamManager.getAllCameras();

      let storageUsed = 0;
      let storageTotal = 1000000000;
      try {
        const globalStats = await storageStatsService.getGlobalStorageStats();
        storageUsed = globalStats.totalBytes;
        const maxStorageGB = await (storageStatsService as any).getMaxStorageGB();
        storageTotal = maxStorageGB * 1024 * 1024 * 1024;
      } catch (err) {
        console.warn('Failed to fetch storage stats for overview:', err);
      }

      const recentEvents = inMemoryState.getRecentEvents();
      const overview = {
        status: 'healthy',
        uptime: process.uptime(),
        totalCameras: cameras.length,
        onlineCameras: cameras.filter((c: Camera) => c.isActive).length,
        totalEvents: recentEvents.length,
        todayEvents: recentEvents.filter((e: MotionEvent) => {
          const eventDate = new Date(e.timestamp);
          const today = new Date();
          return eventDate.getDate() === today.getDate() &&
            eventDate.getMonth() === today.getMonth() &&
            eventDate.getFullYear() === today.getFullYear();
        }).length,
        storageUsed,
        storageTotal
      };

      res.json({ success: true, data: overview });
    } catch (error) {
      console.error('Error getting system overview:', error);
      res.status(500).json({ success: false, error: 'Failed to get system overview' });
    }
  });

  // System health endpoint
  app.get('/api/system/health', optionalAuth, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const cameras = streamManager.getAllCameras();
      const onlineCameras = cameras.filter((c: any) => c.isActive);
      const offlineCameras = cameras.filter((c: any) => !c.isActive);

      let status = 'healthy';
      const issues: string[] = [];
      if (offlineCameras.length > 0) { status = 'warning'; issues.push(`${offlineCameras.length} camera(s) offline`); }
      if (onlineCameras.length === 0 && cameras.length > 0) { status = 'critical'; issues.push('All cameras offline'); }

      const uptime = process.uptime();
      if (uptime < 300) issues.push('System recently restarted');

      const recentEvents = inMemoryState.getRecentEvents();
      res.json({
        success: true,
        health: {
          status,
          uptime,
          issues,
          cameras: { total: cameras.length, online: onlineCameras.length, offline: offlineCameras.length },
          memory: {
            used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
          },
          events: {
            recent: recentEvents.length,
            today: recentEvents.filter(e => {
              const eventDate = new Date(e.timestamp);
              const today = new Date();
              return eventDate.getDate() === today.getDate() && eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear();
            }).length
          }
        }
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({ success: false, error: 'Failed to get system health' });
    }
  });

  // Get system logs
  app.get('/api/system/logs', requireUser, async (req: Request, res: Response) => {
    try {
      const { level, limit } = req.query;
      const logs: Array<{ timestamp: string; level: string; message: string; context?: string }> = [];

      const logsDir = path.join(__dirname, '../../logs');
      const errorLogFile = path.join(logsDir, 'error.log');
      const combinedLogFile = path.join(logsDir, 'combined.log');

      const parseLogFile = (filePath: string, targetLevel?: string): Array<{ timestamp: string; level: string; message: string; context?: string }> => {
        const entries: Array<{ timestamp: string; level: string; message: string; context?: string }> = [];
        if (!fs.existsSync(filePath)) return entries;

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          const match = line.match(/^\[([\d-T:.Z]+)\]\s+\[([A-Z]+)\](?:\s+\[([^\]]+)\])?\s+(.+)$/);
          if (match) {
            const [, timestamp, logLevel, context, message] = match;
            if (!targetLevel || logLevel === targetLevel) {
              entries.push({ timestamp, level: logLevel, message, context });
            }
          }
        }
        return entries;
      };

      logs.push(...parseLogFile(combinedLogFile, level as string));
      logs.push(...parseLogFile(errorLogFile, 'ERROR'));

      const maxLogs = parseInt(limit as string) || 100;
      res.json({ success: true, logs: logs.slice(-maxLogs).reverse() });
    } catch (error) {
      console.error('Error getting system logs:', error);
      res.status(500).json({ success: false, error: 'Failed to get system logs' });
    }
  });

  // Clear system logs
  app.delete('/api/system/logs', requireAdmin, async (req: Request, res: Response) => {
    try {
      const logsDir = path.join(__dirname, '../../logs');
      const errorLogFile = path.join(logsDir, 'error.log');
      const combinedLogFile = path.join(logsDir, 'combined.log');

      const cleared: string[] = [];
      if (fs.existsSync(errorLogFile)) { fs.writeFileSync(errorLogFile, ''); cleared.push('error.log'); }
      if (fs.existsSync(combinedLogFile)) { fs.writeFileSync(combinedLogFile, ''); cleared.push('combined.log'); }

      res.json({ success: true, message: 'Logs cleared', cleared });
    } catch (error) {
      console.error('Error clearing system logs:', error);
      res.status(500).json({ success: false, error: 'Failed to clear system logs' });
    }
  });
}
