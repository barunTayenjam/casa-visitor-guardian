import cron from 'node-cron';
import { LessThan } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { RateLimitCounter } from '../models/RateLimitCounter.js';
import { logger } from '../utils/logger.js';

const CLEANUP_INTERVAL_HOURS = 1;
const RETENTION_HOURS = 1;

export class RateLimitCleanupService {
  private static instance: RateLimitCleanupService;
  private cleanupTask?: cron.ScheduledTask;

  private constructor() {}

  static getInstance(): RateLimitCleanupService {
    if (!RateLimitCleanupService.instance) {
      RateLimitCleanupService.instance = new RateLimitCleanupService();
    }
    return RateLimitCleanupService.instance;
  }

  async performCleanup(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        logger.warn('Database not initialized, skipping rate limit cleanup', 'RateLimitCleanup');
        return;
      }

      const rateLimitRepo = AppDataSource.getRepository(RateLimitCounter);
      const cutoffTime = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);

      const result = await rateLimitRepo.delete({
        windowStart: LessThan(cutoffTime)
      });

      logger.info(`Rate limit cleanup complete: removed ${result.affected || 0} expired records`, 'RateLimitCleanup');
    } catch (error) {
      logger.error('Rate limit cleanup failed', 'RateLimitCleanup', error);
    }
  }

  start(): void {
    if (this.cleanupTask) {
      logger.warn('Rate limit cleanup task already running', 'RateLimitCleanup');
      return;
    }

    this.cleanupTask = cron.schedule(
      `0 */${CLEANUP_INTERVAL_HOURS} * * * *`,
      () => {
        this.performCleanup().catch(error => {
          logger.error('Scheduled rate limit cleanup failed', 'RateLimitCleanup', error);
        });
      },
      {
        scheduled: true,
        timezone: 'Asia/Kolkata'
      }
    );

    logger.info(`Rate limit cleanup service started (runs every ${CLEANUP_INTERVAL_HOURS} hour(s))`, 'RateLimitCleanup');
  }

  stop(): void {
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = undefined;
      logger.info('Rate limit cleanup service stopped', 'RateLimitCleanup');
    }
  }

  async runOnce(): Promise<void> {
    await this.performCleanup();
  }
}

export const rateLimitCleanupService = RateLimitCleanupService.getInstance();
