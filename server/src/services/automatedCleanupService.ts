import { retentionPolicyService } from './retentionPolicyService.js';
import { AppDataSource } from '../database.js';
import { Event } from '../models/Event.js';
import { EventEmitter } from 'events';
import cron from 'node-cron';
import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);
const DETECTIONS_DIR = process.env.DETECTIONS_DIR || '/app/data/detections';

interface CleanupResult {
  camera?: string;
  category?: string;
  deletedFiles: number;
  freedBytes: number;
  deletedEvents: number;
  timestamp: Date;
}

interface CleanupStats {
  lastCleanupTime: Date | null;
  totalCleanupRuns: number;
  totalFilesDeleted: number;
  totalBytesFreed: number;
  totalEventsDeleted: number;
  averageCleanupTime: number;
}

export class AutomatedCleanupService extends EventEmitter {
  private static instance: AutomatedCleanupService;
  private initialized = false;
  private cleanupInProgress = false;
  private cleanupHistory: CleanupResult[] = [];
  private readonly MAX_HISTORY_SIZE = 100;
  private cronTask: cron.ScheduledTask | null = null;

  private constructor() {
    super();
  }

  static getInstance(): AutomatedCleanupService {
    if (!AutomatedCleanupService.instance) {
      AutomatedCleanupService.instance = new AutomatedCleanupService();
    }
    return AutomatedCleanupService.instance;
  }

  async cleanupOldImages(retentionDays: number = 7): Promise<{ deleted: number; preserved: number; freedBytes: number }> {
    logger.info(`Starting image cleanup - keeping images analyzed by AI for ${retentionDays} days...`, 'CLEANUP');

    let deleted = 0;
    let preserved = 0;
    let freedBytes = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const analyzedResults = await AppDataSource.query(
        `SELECT DISTINCT event_filename FROM ai_analysis_results WHERE analyzed_at IS NOT NULL`
      );
      const analyzedFilenames = new Set(analyzedResults.map((r: any) => r.event_filename));
      logger.info(`Found ${analyzedFilenames.size} AI-analyzed images to preserve`, 'CLEANUP');

      const oldEvents = await AppDataSource.getRepository(Event)
        .createQueryBuilder('event')
        .select(['event.id', 'event.file_path', 'event.camera_id'])
        .where('event.timestamp < :cutoffDate', { cutoffDate })
        .andWhere('event.file_path IS NOT NULL')
        .getMany();

      logger.info(`Found ${oldEvents.length} events older than ${retentionDays} days`, 'CLEANUP');

      for (const event of oldEvents) {
        if (!event.file_path) continue;
        if (analyzedFilenames.has(event.file_path)) { preserved++; continue; }

        const possiblePaths = [
          path.join(DETECTIONS_DIR, 'events', event.camera_id || '', event.file_path),
          path.join(DETECTIONS_DIR, event.file_path),
          path.join(DETECTIONS_DIR, 'detections', event.camera_id || '', event.file_path),
        ];

        for (const filePath of possiblePaths) {
          try {
            const stats = await fs.stat(filePath);
            await fs.unlink(filePath);
            deleted++;
            freedBytes += stats.size;
            break;
          } catch (err: unknown) {
            const cleanupErr = err as { code?: string; message?: string };
            if (cleanupErr.code !== 'ENOENT') logger.error(`Error deleting ${filePath}: ${cleanupErr.message}`, 'CLEANUP');
          }
        }
      }

      logger.info(`Image cleanup complete: ${deleted} deleted, ${preserved} preserved, ${(freedBytes / 1024 / 1024).toFixed(2)} MB freed`, 'CLEANUP');
      return { deleted, preserved, freedBytes };
    } catch (error) {
      logger.error('Error during image cleanup', 'CLEANUP', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.scheduleAutomaticCleanup();
      this.initialized = true;
      logger.info('AutomatedCleanupService initialized', 'CLEANUP');
    } catch (error) {
      logger.error('Failed to initialize AutomatedCleanupService', 'CLEANUP', error);
      throw error;
    }
  }

  private async scheduleAutomaticCleanup(): Promise<void> {
    const cleanupSchedule = process.env.CLEANUP_SCHEDULE || '0 2 * * *';
    this.cronTask = cron.schedule(cleanupSchedule, async () => {
      await this.runAutomaticCleanup();
    }, { timezone: process.env.TZ || 'UTC' });
    logger.info(`Scheduled automatic cleanup at ${cleanupSchedule}`, 'CLEANUP');
  }

  async runAutomaticCleanup(): Promise<void> {
    if (this.cleanupInProgress) { logger.warn('Cleanup already in progress, skipping', 'CLEANUP'); return; }

    this.cleanupInProgress = true;
    const startTime = Date.now();

    try {
      await this.cleanupExpiredFiles();

      const duration = Date.now() - startTime;
      logger.info(`Automatic cleanup completed in ${duration}ms`, 'CLEANUP');
      this.emit('cleanupCompleted', { duration });
    } catch (error) {
      logger.error('Error during automatic cleanup', 'CLEANUP', error);
      this.emit('cleanupError', error);
    } finally {
      this.cleanupInProgress = false;
    }
  }

  private async cleanupExpiredFiles(): Promise<void> {
    try {
      const policy = await retentionPolicyService.getPolicy();
      if (policy.retain_indefinitely) {
        logger.info('Retention set to indefinite, skipping file cleanup', 'CLEANUP');
        return;
      }

      const detectionDays = policy.detections_days;
      const eventDays = policy.events_days;
      const retentionDays = Math.min(detectionDays, eventDays);

      const totalDeleted = await this.deleteOldFiles(retentionDays);
      if (totalDeleted > 0) {
        logger.info(`Deleted ${totalDeleted} expired detection files (retention: ${retentionDays} days)`, 'CLEANUP');
      } else {
        logger.info('No expired detection files to clean up', 'CLEANUP');
      }

      await this.cleanupEmptyMonthDirs();
    } catch (error) {
      logger.error('Error cleaning up expired files', 'CLEANUP', error);
      throw error;
    }
  }

  private async deleteOldFiles(days: number): Promise<number> {
    try {
      const { stdout } = await execFileAsync('find', [
        DETECTIONS_DIR,
        '-name', '*.jpg',
        '-mtime', `+${days}`,
        '-type', 'f',
        '-delete',
        '-print',
      ], { timeout: 300000, maxBuffer: 50 * 1024 * 1024 });

      const count = stdout.trim().split('\n').filter(Boolean).length;
      return count;
    } catch (error) {
      logger.error(`Error running find/delete: ${error}`, 'CLEANUP');
      return 0;
    }
  }

  private async cleanupEmptyMonthDirs(): Promise<void> {
    const detectionsDir = process.env.DETECTIONS_DIR || '/app/data/detections';
    try {
      const entries = await fs.readdir(detectionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name)) {
          const dirPath = path.join(detectionsDir, entry.name);
          await this.removeEmptyDirs(dirPath);
        }
      }
    } catch (error) {
      logger.warn(`Error cleaning empty directories: ${error}`, 'CLEANUP');
    }
  }

  private async removeEmptyDirs(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.removeEmptyDirs(path.join(dirPath, entry.name));
        }
      }
      const remaining = await fs.readdir(dirPath);
      if (remaining.length === 0) {
        await fs.rmdir(dirPath);
        logger.info(`Removed empty directory: ${dirPath}`, 'CLEANUP');
      }
    } catch {
      // Directory not empty or in use, skip
    }
  }

  isCleanupInProgress(): boolean { return this.cleanupInProgress; }

  isInitialized(): boolean { return this.initialized; }

  async shutdown(): Promise<void> {
    if (this.cronTask) {
      this.cronTask.stop();
      logger.info('Cleanup scheduler stopped', 'CLEANUP');
    }
  }
}

export const automatedCleanupService = AutomatedCleanupService.getInstance();
export default automatedCleanupService;
