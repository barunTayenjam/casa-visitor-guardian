import { retentionPolicyService } from './retentionPolicyService.js';
import { storageStatsService } from './storageStatsService.js';
import { AppDataSource } from '../database.js';
import { Event } from '../models/Event.js';
import { EventEmitter } from 'events';
import cron from 'node-cron';

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
    console.log('AutomatedCleanupService: Initializing');
  }

  static getInstance(): AutomatedCleanupService {
    if (!AutomatedCleanupService.instance) {
      AutomatedCleanupService.instance = new AutomatedCleanupService();
    }
    return AutomatedCleanupService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.scheduleAutomaticCleanup();
      this.initialized = true;
      console.log('AutomatedCleanupService initialized');
    } catch (error) {
      console.error('Failed to initialize AutomatedCleanupService:', error);
      throw error;
    }
  }

  private async scheduleAutomaticCleanup(): Promise<void> {
    const cleanupSchedule = process.env.CLEANUP_SCHEDULE || '0 2 * * *';

    this.cronTask = cron.schedule(cleanupSchedule, async () => {
      console.log('Running scheduled cleanup...');
      await this.runAutomaticCleanup();
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC',
    });

    console.log(`Scheduled automatic cleanup at ${cleanupSchedule}`);
  }

  async runAutomaticCleanup(): Promise<void> {
    if (this.cleanupInProgress) {
      console.log('Cleanup already in progress, skipping');
      return;
    }

    this.cleanupInProgress = true;
    const startTime = Date.now();

    try {
      console.log('Starting automatic cleanup process...');

      await this.cleanupExpiredFiles();
      await this.cleanupExpiredEvents();
      await this.cleanupByStorageThreshold();
      await storageStatsService.calculateAllStats();

      const duration = Date.now() - startTime;
      console.log(`Automatic cleanup completed in ${duration}ms`);

      this.emit('cleanupCompleted', { duration });
    } catch (error) {
      console.error('Error during automatic cleanup:', error);
      this.emit('cleanupError', error);
    } finally {
      this.cleanupInProgress = false;
    }
  }

  private async cleanupExpiredFiles(): Promise<void> {
    try {
      console.log('Cleaning up expired files based on retention policies...');

      const policies = await retentionPolicyService.getAllPolicies();
      const cameras = ['cam1', 'cam2'];
      const categories = ['alerts', 'detections', 'previews', 'snapshots', 'events'];

      for (const policy of policies) {
        const camera = policy.camera || undefined;

        for (const category of categories) {
          const result = await this.cleanupCategory(camera, category);
          if (result.deletedFiles > 0) {
            console.log(`Cleaned up ${result.deletedFiles} ${category} files for ${camera || 'global'}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired files:', error);
      throw error;
    }
  }

  private async cleanupCategory(camera: string | undefined, category: string): Promise<CleanupResult> {
    const startTime = Date.now();
    let deletedFiles = 0;
    let freedBytes = 0;

    try {
      const expiredFiles = await retentionPolicyService.getExpiredFiles(camera, category);

      for (const filePath of expiredFiles) {
        try {
          const { promises: fs } = await import('fs');
          const stats = await fs.stat(filePath);
          await fs.unlink(filePath);

          deletedFiles++;
          freedBytes += stats.size;
        } catch (error) {
          console.warn(`Error deleting file ${filePath}:`, error);
        }
      }

      const result: CleanupResult = {
        camera,
        category,
        deletedFiles,
        freedBytes,
        deletedEvents: 0,
        timestamp: new Date(),
      };

      this.addToHistory(result);

      return result;
    } catch (error) {
      console.error(`Error cleaning up ${category} for ${camera || 'global'}:`, error);
      throw error;
    }
  }

  private async cleanupExpiredEvents(): Promise<void> {
    try {
      console.log('Cleaning up expired events from database...');

      const policies = await retentionPolicyService.getAllPolicies();
      let totalDeleted = 0;

      for (const policy of policies) {
        const camera = policy.camera;
        const retentionDays = policy.events_days;

        if (policy.retain_indefinitely) {
          continue;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const deleteResult = await AppDataSource.getRepository(Event)
          .createQueryBuilder('event')
          .delete()
          .where('event.timestamp < :cutoffDate', { cutoffDate })
          .andWhere(camera ? 'event.camera_id = :camera' : '1=1', { camera: camera || '' })
          .execute();

        const deletedCount = deleteResult.affected || 0;
        totalDeleted += deletedCount;

        if (deletedCount > 0) {
          console.log(`Deleted ${deletedCount} expired events for ${camera || 'all cameras'}`);
        }
      }

      if (totalDeleted > 0) {
        console.log(`Total expired events deleted: ${totalDeleted}`);
      }
    } catch (error) {
      console.error('Error cleaning up expired events:', error);
      throw error;
    }
  }

  private async cleanupByStorageThreshold(): Promise<void> {
    try {
      const globalStats = await storageStatsService.getGlobalStorageStats();
      const maxStorageGB = await this.getMaxStorageGB();
      const usedStorageGB = globalStats.totalBytes / (1024 * 1024 * 1024);
      const usagePercentage = (usedStorageGB / maxStorageGB) * 100;

      const WARNING_THRESHOLD = 80;
      const CRITICAL_THRESHOLD = 90;

      if (usagePercentage >= CRITICAL_THRESHOLD) {
        console.warn(`Storage usage critical: ${usagePercentage.toFixed(2)}%. Running aggressive cleanup...`);
        await this.runAggressiveCleanup();
      } else if (usagePercentage >= WARNING_THRESHOLD) {
        console.warn(`Storage usage high: ${usagePercentage.toFixed(2)}%. Running standard cleanup...`);
        await this.runStandardCleanup();
      }
    } catch (error) {
      console.error('Error checking storage threshold:', error);
    }
  }

  private async runAggressiveCleanup(): Promise<void> {
    const categories = ['alerts', 'detections', 'previews', 'snapshots', 'events'];
    const cameras = ['cam1', 'cam2'];

    for (const camera of cameras) {
      for (const category of categories) {
        const result = await this.cleanupOldestFiles(camera, category, 0.1);
        if (result.deletedFiles > 0) {
          console.log(`Aggressive cleanup: Removed ${result.deletedFiles} ${category} files from ${camera}`);
        }
      }
    }
  }

  private async runStandardCleanup(): Promise<void> {
    const categories = ['alerts', 'detections', 'previews', 'snapshots', 'events'];

    for (const category of categories) {
      const result = await this.cleanupCategory(undefined, category);
      if (result.deletedFiles > 0) {
        console.log(`Standard cleanup: Removed ${result.deletedFiles} ${category} files`);
      }
    }
  }

  private async cleanupOldestFiles(camera: string, category: string, percentageToRemove: number): Promise<CleanupResult> {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const detectionsDir = process.env.DETECTIONS_DIR || '/app/data/detections';

    let categoryPath: string;
    switch (category) {
      case 'alerts':
        categoryPath = path.join(detectionsDir, 'alerts');
        break;
      case 'snapshots':
        categoryPath = path.join(detectionsDir, 'snapshots');
        break;
      case 'previews':
        categoryPath = path.join(detectionsDir, 'previews');
        break;
      case 'detections':
        categoryPath = path.join(detectionsDir, `detections_${camera}`);
        break;
      case 'events':
        categoryPath = path.join(detectionsDir, `events_${camera}`);
        break;
      default:
        categoryPath = path.join(detectionsDir, category);
    }

    let deletedFiles = 0;
    let freedBytes = 0;

    try {
      await fs.access(categoryPath);

      const allFiles = await this.scanDirectoryWithStats(categoryPath);
      const filesToDelete = Math.ceil(allFiles.length * percentageToRemove);

      allFiles.sort((a, b) => a.mtimeMs - b.mtimeMs);

      for (let i = 0; i < Math.min(filesToDelete, allFiles.length); i++) {
        try {
          await fs.unlink(allFiles[i].path);
          deletedFiles++;
          freedBytes += allFiles[i].size;
        } catch (error) {
          console.warn(`Error deleting file ${allFiles[i].path}:`, error);
        }
      }

      const result: CleanupResult = {
        camera,
        category,
        deletedFiles,
        freedBytes,
        deletedEvents: 0,
        timestamp: new Date(),
      };

      this.addToHistory(result);

      return result;
    } catch (error) {
      console.warn(`Error in aggressive cleanup for ${camera}/${category}:`, error);
      return {
        camera,
        category,
        deletedFiles: 0,
        freedBytes: 0,
        deletedEvents: 0,
        timestamp: new Date(),
      };
    }
  }

  private async scanDirectoryWithStats(dirPath: string, maxDepth = 3): Promise<Array<{ path: string; size: number; mtimeMs: number }>> {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const files: Array<{ path: string; size: number; mtimeMs: number }> = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && maxDepth > 0) {
          const subFiles = await this.scanDirectoryWithStats(fullPath, maxDepth - 1);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            files.push({
              path: fullPath,
              size: stats.size,
              mtimeMs: stats.mtimeMs,
            });
          } catch (error) {
            console.warn(`Error reading file stats for ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Error scanning directory ${dirPath}:`, error);
    }

    return files;
  }

  private addToHistory(result: CleanupResult): void {
    this.cleanupHistory.push(result);

    if (this.cleanupHistory.length > this.MAX_HISTORY_SIZE) {
      this.cleanupHistory.shift();
    }
  }

  async getCleanupHistory(limit = 20): Promise<CleanupResult[]> {
    return this.cleanupHistory.slice(-limit);
  }

  async getCleanupStats(): Promise<CleanupStats> {
    const totalCleanupRuns = this.cleanupHistory.length;
    const totalFilesDeleted = this.cleanupHistory.reduce((sum, r) => sum + r.deletedFiles, 0);
    const totalBytesFreed = this.cleanupHistory.reduce((sum, r) => sum + r.freedBytes, 0);
    const totalEventsDeleted = this.cleanupHistory.reduce((sum, r) => sum + r.deletedEvents, 0);

    const totalTime = this.cleanupHistory.reduce((sum, r) => {
      return sum + (Date.now() - r.timestamp.getTime());
    }, 0);

    const averageCleanupTime = totalCleanupRuns > 0 ? totalTime / totalCleanupRuns : 0;

    return {
      lastCleanupTime: this.cleanupHistory.length > 0 ? this.cleanupHistory[this.cleanupHistory.length - 1].timestamp : null,
      totalCleanupRuns,
      totalFilesDeleted,
      totalBytesFreed,
      totalEventsDeleted,
      averageCleanupTime,
    };
  }

  async runManualCleanup(camera?: string, category?: string): Promise<CleanupResult> {
    if (this.cleanupInProgress) {
      throw new Error('Cleanup already in progress');
    }

    this.cleanupInProgress = true;

    try {
      console.log(`Running manual cleanup for ${camera || 'all'} / ${category || 'all'}...`);

      let totalDeletedFiles = 0;
      let totalFreedBytes = 0;

      if (category) {
        const result = await this.cleanupCategory(camera, category);
        totalDeletedFiles += result.deletedFiles;
        totalFreedBytes += result.freedBytes;
      } else {
        const categories = ['alerts', 'detections', 'previews', 'snapshots', 'events'];
        for (const cat of categories) {
          const result = await this.cleanupCategory(camera, cat);
          totalDeletedFiles += result.deletedFiles;
          totalFreedBytes += result.freedBytes;
        }
      }

      await storageStatsService.calculateAllStats();

      const result: CleanupResult = {
        camera,
        category,
        deletedFiles: totalDeletedFiles,
        freedBytes: totalFreedBytes,
        deletedEvents: 0,
        timestamp: new Date(),
      };

      this.emit('manualCleanupCompleted', result);

      return result;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  private async getMaxStorageGB(): Promise<number> {
    try {
      const settings = await AppDataSource.query(`SELECT maxstoragegb FROM system_settings LIMIT 1`);
      return settings[0]?.maxstoragegb || 100;
    } catch {
      return 100;
    }
  }

  isCleanupInProgress(): boolean {
    return this.cleanupInProgress;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('Cleanup scheduler stopped');
    }
  }
}

export const automatedCleanupService = AutomatedCleanupService.getInstance();
export default automatedCleanupService;
