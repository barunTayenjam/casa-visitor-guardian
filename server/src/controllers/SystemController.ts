import { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'url';
import { BaseController } from './BaseController.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { inMemoryState, MotionEvent } from '../services/inMemoryStateService.js';
import { AutomatedCleanupService } from '../services/automatedCleanupService.js';
import type { Camera } from '../streams/rtspManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SystemController extends BaseController {
  health(req: Request, res: Response): void {
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
  }

  async stats(req: Request, res: Response): Promise<void> {
    try {
      const { AppDataSource } = await import('../database.js');
      const { Event } = await import('../models/index.js');

      const eventRepo = AppDataSource.getRepository(Event);
      const totalEvents = await eventRepo.count();

      const streamManager = serviceRegistry.getStreamManager();
      const cameras = streamManager.getAllCameras();
      const activeCameras = cameras.filter((c: any) => c.isActive).length;

      let knownVisitors = 0;
      try {
        const visitorResult = await AppDataSource.query('SELECT COUNT(Distinct visitor_id) as count FROM visitor_timeline');
        knownVisitors = parseInt(visitorResult?.[0]?.count) || 0;
      } catch {}

      this.ok(res, {
        stats: {
          totalEvents,
          totalCameras: cameras.length,
          activeCameras,
          knownVisitors,
          storageUsed: 0,
          storageTotal: 0,
        }
      });
    } catch (error: any) {
      this.serverError(res, error, 'stats');
    }
  }

  async cleanupImages(req: Request, res: Response): Promise<void> {
    try {
      const retentionDays = parseInt(req.body.retentionDays) || 7;
      if (retentionDays < 1 || retentionDays > 365) {
        this.badRequest(res, 'Retention days must be between 1 and 365');
        return;
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
      this.serverError(res, error, 'cleanupImages');
    }
  }

  async runFullCleanup(_req: Request, res: Response): Promise<void> {
    try {
      console.log('Admin triggered full retention cleanup');
      const cleanupService = AutomatedCleanupService.getInstance();
      await cleanupService.runAutomaticCleanup();
      res.json({ success: true, message: 'Full cleanup completed' });
    } catch (error: any) {
      this.serverError(res, error, 'runFullCleanup');
    }
  }

  async cleanupStatus(_req: Request, res: Response): Promise<void> {
    res.status(501).json({ success: false, error: 'Not implemented - use POST /api/maintenance/cleanup-images instead', code: 'NOT_IMPLEMENTED' });
  }

  async overview(req: Request, res: Response): Promise<void> {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const cameras = streamManager.getAllCameras();

      let storageUsed = 0;
      let storageTotal = 1000000000;

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

      this.ok(res, { data: overview });
    } catch (error) {
      this.serverError(res, error, 'overview');
    }
  }

  systemHealth(req: Request, res: Response): void {
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

      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      const cpuUsage = (loadAvg[0] / cpus.length) * 100;

      res.json({
        success: true,
        health: {
          status,
          uptime,
          issues,
          cameras: { total: cameras.length, online: onlineCameras.length, offline: offlineCameras.length },
          memory: {
            used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
            systemTotal: Math.round((os.totalmem() / 1024 / 1024) * 100) / 100,
            systemFree: Math.round((os.freemem() / 1024 / 1024) * 100) / 100
          },
          cpu: {
            usage: Math.min(100, Math.round(cpuUsage * 100) / 100),
            cores: cpus.length,
            model: cpus[0].model,
            loadAvg: loadAvg
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
      this.serverError(res, error, 'systemHealth');
    }
  }

  async getLogs(req: Request, res: Response): Promise<void> {
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
      this.ok(res, { logs: logs.slice(-maxLogs).reverse() });
    } catch (error) {
      this.serverError(res, error, 'getLogs');
    }
  }

  async clearLogs(req: Request, res: Response): Promise<void> {
    try {
      const logsDir = path.join(__dirname, '../../logs');
      const errorLogFile = path.join(logsDir, 'error.log');
      const combinedLogFile = path.join(logsDir, 'combined.log');

      const cleared: string[] = [];
      if (fs.existsSync(errorLogFile)) { fs.writeFileSync(errorLogFile, ''); cleared.push('error.log'); }
      if (fs.existsSync(combinedLogFile)) { fs.writeFileSync(combinedLogFile, ''); cleared.push('combined.log'); }

      this.ok(res, { message: 'Logs cleared', cleared });
    } catch (error) {
      this.serverError(res, error, 'clearLogs');
    }
  }
}

export const systemController = new SystemController();
