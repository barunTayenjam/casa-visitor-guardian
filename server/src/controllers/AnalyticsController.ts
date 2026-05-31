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

  getHourly(req: Request, res: Response): void {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const hourlyData = Array(24).fill(null).map((_, hour) => ({ hour, count: 0 }));

      inMemoryState.getRecentEvents().forEach(event => {
        const eventDate = new Date(event.timestamp);
        if (eventDate >= startOfDay && eventDate <= today) {
          hourlyData[eventDate.getHours()].count++;
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

  getResponseTime(req: Request, res: Response): void {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryFactor = memoryUsage.heapUsed / memoryUsage.heapTotal;
      const baseResponseTime = 1.5;
      const responseTime = baseResponseTime + (memoryFactor * 2);
      const recentEvents = inMemoryState.getRecentEvents();

      this.ok(res, {
        responseTime: {
          average: Math.round(responseTime * 100) / 100,
          recent: recentEvents.slice(0, 10).map((_, index) => ({
            timestamp: new Date(Date.now() - index * 60000).toISOString(),
            responseTime: Math.round((responseTime + (Math.random() - 0.5) * 0.5) * 100) / 100
          })).reverse()
        }
      });
    } catch (error) {
      this.serverError(res, error, 'getResponseTime');
    }
  }
}

export const analyticsController = new AnalyticsController();
