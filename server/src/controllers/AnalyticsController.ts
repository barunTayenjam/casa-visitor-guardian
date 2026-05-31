import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import { inMemoryState } from '../services/inMemoryStateService.js';

export class AnalyticsController extends BaseController {
  async getStorageStats(req: Request, res: Response): Promise<void> {
    try {
      const { AppDataSource } = await import('../database.js');
      const dbResult = await AppDataSource.query(
        `SELECT COALESCE(SUM(file_size), 0) as total_bytes FROM detection_files WHERE is_deleted = FALSE`
      );
      const storageUsed = parseInt(dbResult[0]?.total_bytes) || 0;

      const { config } = await import('../config/index.js');
      let storageTotal = 0;
      try {
        const fs = await import('node:fs');
        const detectionsPath = config.storage.detectionsDir;
        if (fs.existsSync(detectionsPath)) {
          const stat = fs.statfsSync(detectionsPath);
          storageTotal = stat.blocks * stat.bsize;
        }
      } catch {}

      this.ok(res, { storageUsed, storageTotal });
    } catch (error) {
      this.serverError(res, error, 'getStorageStats');
    }
  }

  async getHourly(req: Request, res: Response): Promise<void> {
    try {
      const { AppDataSource } = await import('../database.js');
      const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
      const endDate = (req.query.endDate as string) || new Date().toISOString();

      const result = await AppDataSource.query(
        `SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count
         FROM events
         WHERE timestamp >= $1::timestamptz AND timestamp <= $2::timestamptz
         GROUP BY hour
         ORDER BY hour`,
        [startDate, endDate]
      );

      const hourlyData = Array(24).fill(null).map((_, hour) => ({ hour, count: 0 }));
      result.forEach((row: { hour: number; count: number }) => {
        const h = parseInt(String(row.hour));
        if (h >= 0 && h < 24) {
          hourlyData[h].count = parseInt(String(row.count));
        }
      });

      this.ok(res, { hourlyData });
    } catch (error) {
      this.serverError(res, error, 'getHourly');
    }
  }

  getWeekly(req: Request, res: Response): void {
    try {
      const today = new Date();
      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentEvents = inMemoryState.getRecentEvents();
      const weeklyEvents = recentEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= oneWeekAgo && eventDate <= today;
      });

      this.ok(res, {
        weeklyData: {
          totalEvents: weeklyEvents.length,
          dailyBreakdown: Array(7).fill(null).map((_, dayIndex) => {
            const date = new Date(today.getTime() - dayIndex * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            const dayEvents = weeklyEvents.filter(event => {
              const eventDate = new Date(event.timestamp);
              return eventDate >= dayStart && eventDate < dayEnd;
            });
            return { date: dayStart.toISOString().split('T')[0], count: dayEvents.length };
          }).reverse()
        }
      });
    } catch (error) {
      this.serverError(res, error, 'getWeekly');
    }
  }

  getMonthly(req: Request, res: Response): void {
    try {
      const today = new Date();
      const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      const recentEvents = inMemoryState.getRecentEvents();
      const monthlyEvents = recentEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= oneMonthAgo && eventDate <= today;
      });

      this.ok(res, {
        monthlyData: {
          totalEvents: monthlyEvents.length,
          weeklyBreakdown: Array(4).fill(null).map((_, weekIndex) => {
            const weekStart = new Date(today.getTime() - (weekIndex + 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            const weekEvents = monthlyEvents.filter((event: any) => {
              const eventDate = new Date(event.timestamp);
              return eventDate >= weekStart && eventDate < weekEnd;
            });
            return { week: `Week ${4 - weekIndex}`, count: weekEvents.length };
          }).reverse()
        }
      });
    } catch (error) {
      this.serverError(res, error, 'getMonthly');
    }
  }

}

export const analyticsController = new AnalyticsController();
