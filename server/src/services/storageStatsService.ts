import { AppDataSource } from '../database.js';
import { StorageStats } from '../models/StorageStats.js';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

interface StorageBreakdown {
  [fileType: string]: {
    bytes: number;
    count: number;
  };
}

interface StorageCalculationResult {
  totalBytes: number;
  fileCount: number;
  oldestFileDays: number;
  breakdown: StorageBreakdown;
}

export class StorageStatsService extends EventEmitter {
  private static instance: StorageStatsService;
  private initialized = false;
  private calculationInProgress = false;
  private readonly DETECTIONS_DIR = process.env.DETECTIONS_DIR || '/app/data/detections';
  private readonly ALERTS_DIR = path.join(this.DETECTIONS_DIR, 'alerts');
  private readonly SNAPSHOTS_DIR = path.join(this.DETECTIONS_DIR, 'snapshots');
  private readonly PREVIEWS_DIR = path.join(this.DETECTIONS_DIR, 'previews');

  private constructor() {
    super();
    console.log('StorageStatsService: Initializing');
  }

  static getInstance(): StorageStatsService {
    if (!StorageStatsService.instance) {
      StorageStatsService.instance = new StorageStatsService();
    }
    return StorageStatsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await AppDataSource.query(`
        INSERT INTO storage_stats (camera, category, total_bytes, file_count, oldest_file_days, breakdown, last_calculated_at)
        VALUES (NULL, 'global', 0, 0, 0, '{}', CURRENT_TIMESTAMP)
        ON CONFLICT (category) WHERE camera IS NULL DO NOTHING
      `);

      this.initialized = true;
      console.log('StorageStatsService initialized');

      await this.calculateAllStats();
    } catch (error) {
      console.error('Failed to initialize StorageStatsService:', error);
      throw error;
    }
  }

  async calculateAllStats(): Promise<void> {
    if (this.calculationInProgress) {
      console.log('Storage calculation already in progress, skipping');
      return;
    }

    this.calculationInProgress = true;

    try {
      console.log('Calculating storage statistics for all categories...');

      const categories = ['alerts', 'detections', 'previews', 'snapshots', 'events'];
      const cameras = ['cam1', 'cam2'];

      for (const category of categories) {
        await this.calculateCategoryStats(category, null);
      }

      for (const camera of cameras) {
        for (const category of categories) {
          await this.calculateCategoryStats(category, camera);
        }
      }

      await this.calculateGlobalStats();
      await this.calculateGrowthRates();

      this.emit('statsUpdated');
      console.log('Storage statistics calculation completed');
    } catch (error) {
      console.error('Error calculating storage statistics:', error);
      throw error;
    } finally {
      this.calculationInProgress = false;
    }
  }

  private async calculateCategoryStats(category: string, camera: string | null): Promise<void> {
    try {
      const result = await this.calculateStorageForCategory(category, camera);

      await AppDataSource.createQueryBuilder()
        .insert()
        .into(StorageStats)
        .values({
          camera,
          category,
          total_bytes: result.totalBytes,
          file_count: result.fileCount,
          oldest_file_days: result.oldestFileDays,
          breakdown: result.breakdown,
          last_calculated_at: new Date(),
        })
        .orUpdate(
          ['total_bytes', 'file_count', 'oldest_file_days', 'breakdown', 'last_calculated_at'],
          ['camera', 'category']
        )
        .execute();
    } catch (error) {
      console.error(`Error calculating stats for ${category}/${camera || 'global'}:`, error);
    }
  }

  private async calculateStorageForCategory(category: string, camera: string | null): Promise<StorageCalculationResult> {
    const categoryPath = this.getCategoryPath(category, camera);

    try {
      await fs.access(categoryPath);
    } catch {
      return {
        totalBytes: 0,
        fileCount: 0,
        oldestFileDays: 0,
        breakdown: {},
      };
    }

    const files = await this.scanDirectory(categoryPath);
    const now = Date.now();
    const breakdown: StorageBreakdown = {};
    let oldestFileAge = 0;

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      const fileType = ext.slice(1) || 'unknown';

      if (!breakdown[fileType]) {
        breakdown[fileType] = { bytes: 0, count: 0 };
      }

      breakdown[fileType].bytes += file.size;
      breakdown[fileType].count += 1;

      const fileAge = now - file.mtimeMs;
      const fileAgeDays = Math.floor(fileAge / (1000 * 60 * 60 * 24));

      if (fileAgeDays > oldestFileAge) {
        oldestFileAge = fileAgeDays;
      }
    }

    return {
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      fileCount: files.length,
      oldestFileDays: oldestFileAge,
      breakdown,
    };
  }

  private async scanDirectory(dirPath: string, maxDepth = 3): Promise<Array<{ name: string; size: number; mtimeMs: number }>> {
    const files: Array<{ name: string; size: number; mtimeMs: number }> = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && maxDepth > 0) {
          const subFiles = await this.scanDirectory(fullPath, maxDepth - 1);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            files.push({
              name: fullPath,
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

  private getCategoryPath(category: string, camera: string | null): string {
    const cameraSuffix = camera ? `_${camera}` : '';

    switch (category) {
      case 'alerts':
        return this.ALERTS_DIR;
      case 'snapshots':
        return this.SNAPSHOTS_DIR;
      case 'previews':
        return this.PREVIEWS_DIR;
      case 'detections':
        return path.join(this.DETECTIONS_DIR, `detections${cameraSuffix}`);
      case 'events':
        return path.join(this.DETECTIONS_DIR, `events${cameraSuffix}`);
      default:
        return path.join(this.DETECTIONS_DIR, category);
    }
  }

  private async calculateGlobalStats(): Promise<void> {
    try {
      const result = await AppDataSource.createQueryBuilder()
        .select('SUM(ss.total_bytes)', 'totalBytes')
        .addSelect('SUM(ss.file_count)', 'fileCount')
        .addSelect('MAX(ss.oldest_file_days)', 'oldestFileDays')
        .from(StorageStats, 'ss')
        .where('ss.camera IS NOT NULL')
        .setParameters({})
        .getRawOne();

      await AppDataSource.createQueryBuilder()
        .insert()
        .into(StorageStats)
        .values({
          camera: null,
          category: 'global',
          total_bytes: parseInt(result.totalBytes) || 0,
          file_count: parseInt(result.fileCount) || 0,
          oldest_file_days: parseInt(result.oldestFileDays) || 0,
          breakdown: {},
          last_calculated_at: new Date(),
        })
        .orUpdate(
          ['total_bytes', 'file_count', 'oldest_file_days', 'breakdown', 'last_calculated_at'],
          ['camera', 'category']
        )
        .execute();
    } catch (error) {
      console.error('Error calculating global stats:', error);
    }
  }

  private async calculateGrowthRates(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const stats = await AppDataSource.getRepository(StorageStats)
        .createQueryBuilder('ss')
        .where('ss.last_calculated_at > :date', { date: sevenDaysAgo })
        .orderBy('ss.last_calculated_at', 'ASC')
        .getMany();

      const groupedStats = new Map<string, StorageStats[]>();

      for (const stat of stats) {
        const key = `${stat.camera || 'global'}-${stat.category}`;
        if (!groupedStats.has(key)) {
          groupedStats.set(key, []);
        }
        groupedStats.get(key)!.push(stat);
      }

      for (const [key, records] of groupedStats.entries()) {
        if (records.length < 2) continue;

        const oldest = records[0];
        const newest = records[records.length - 1];
        const daysDiff = Math.max(1, Math.floor((newest.last_calculated_at.getTime() - oldest.last_calculated_at.getTime()) / (1000 * 60 * 60 * 24)));
        const bytesDiff = newest.total_bytes - oldest.total_bytes;
        const growthRateMB = (bytesDiff / (1024 * 1024)) / daysDiff;

        await AppDataSource.createQueryBuilder()
          .update(StorageStats)
          .set({
            growth_rate_mb_per_day: growthRateMB,
          })
          .where('id = :id', { id: newest.id })
          .execute();
      }
    } catch (error) {
      console.error('Error calculating growth rates:', error);
    }
  }

  async getStorageStats(camera?: string, category?: string): Promise<StorageStats[]> {
    try {
      const query = AppDataSource.getRepository(StorageStats).createQueryBuilder('ss');

      if (camera) {
        query.andWhere('ss.camera = :camera', { camera });
      }

      if (category) {
        query.andWhere('ss.category = :category', { category });
      }

      return await query.orderBy('ss.last_calculated_at', 'DESC').getMany();
    } catch (error) {
      console.error('Error retrieving storage stats:', error);
      throw error;
    }
  }

  async getGlobalStorageStats(): Promise<{
    totalBytes: number;
    totalFiles: number;
    oldestFileDays: number;
    percentageUsed: number;
    breakdown: Record<string, { bytes: number; count: number; percentage: number }>;
  }> {
    try {
      const globalStats = await AppDataSource.getRepository(StorageStats)
        .createQueryBuilder('ss')
        .where('ss.category = :category', { category: 'global' })
        .andWhere('ss.camera IS NULL')
        .orderBy('ss.last_calculated_at', 'DESC')
        .getOne();

      if (!globalStats) {
        throw new Error('Global storage stats not found');
      }

      const maxStorageGB = await this.getMaxStorageGB();
      const percentageUsed = (globalStats.total_bytes / (maxStorageGB * 1024 * 1024 * 1024)) * 100;

      const categoryStats = await AppDataSource.getRepository(StorageStats)
        .createQueryBuilder('ss')
        .where('ss.camera IS NULL')
        .andWhere('ss.category != :category', { category: 'global' })
        .getMany();

      const breakdown: Record<string, { bytes: number; count: number; percentage: number }> = {};

      for (const stat of categoryStats) {
        breakdown[stat.category] = {
          bytes: stat.total_bytes,
          count: stat.file_count,
          percentage: globalStats.total_bytes > 0 ? (stat.total_bytes / globalStats.total_bytes) * 100 : 0,
        };
      }

      return {
        totalBytes: globalStats.total_bytes,
        totalFiles: globalStats.file_count,
        oldestFileDays: globalStats.oldest_file_days,
        percentageUsed,
        breakdown,
      };
    } catch (error) {
      console.error('Error retrieving global storage stats:', error);
      throw error;
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

  async getStorageProjection(days = 30): Promise<{
    projectedBytes: number;
    projectedGB: number;
    willExceedCapacity: boolean;
    daysUntilFull: number | null;
  }> {
    try {
      const globalStats = await this.getGlobalStorageStats();
      const allStats = await this.getStorageStats();

      let totalGrowthRate = 0;

      for (const stat of allStats) {
        if (stat.category !== 'global') {
          totalGrowthRate += stat.growth_rate_mb_per_day;
        }
      }

      const projectedGrowthMB = totalGrowthRate * days;
      const projectedBytes = globalStats.totalBytes + (projectedGrowthMB * 1024 * 1024);
      const projectedGB = projectedBytes / (1024 * 1024 * 1024);

      const maxStorageGB = await this.getMaxStorageGB();
      const willExceedCapacity = projectedGB > maxStorageGB;

      let daysUntilFull: number | null = null;
      if (totalGrowthRate > 0) {
        const remainingGB = maxStorageGB - (globalStats.totalBytes / (1024 * 1024 * 1024));
        daysUntilFull = Math.ceil(remainingGB / (totalGrowthRate / 1024));
      }

      return {
        projectedBytes,
        projectedGB,
        willExceedCapacity,
        daysUntilFull,
      };
    } catch (error) {
      console.error('Error calculating storage projection:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const storageStatsService = StorageStatsService.getInstance();
export default storageStatsService;
