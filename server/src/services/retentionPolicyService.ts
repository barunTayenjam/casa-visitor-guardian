import { AppDataSource } from '../database.js';
import { RetentionPolicy } from '../models/RetentionPolicy.js';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

interface RetentionConfig {
  camera?: string;
  alertsDays: number;
  detectionsDays: number;
  previewsDays: number;
  snapshotsDays: number;
  eventsDays: number;
  retainIndefinitely: boolean;
}

export class RetentionPolicyService extends EventEmitter {
  private static instance: RetentionPolicyService;
  private initialized = false;
  private policyCache: Map<string, { policy: RetentionPolicy; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private readonly DEFAULT_RETENTION_DAYS = {
    alerts: 7,
    snapshots: 7,
    events: 7,
    detections: 30,
    previews: 14,
  };
  private creatingPolicy = false;

  private constructor() {
    super();
    console.log('RetentionPolicyService: Initializing');
  }

  static getInstance(): RetentionPolicyService {
    if (!RetentionPolicyService.instance) {
      RetentionPolicyService.instance = new RetentionPolicyService();
    }
    return RetentionPolicyService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const hasGlobalPolicy = await AppDataSource.getRepository(RetentionPolicy)
        .createQueryBuilder('rp')
        .where('rp.camera IS NULL')
        .getExists();

      if (!hasGlobalPolicy) {
        await this.createGlobalPolicy();
      }

      this.initialized = true;
      console.log('RetentionPolicyService initialized');
    } catch (error) {
      console.error('Failed to initialize RetentionPolicyService:', error);
      throw error;
    }
  }

  async createGlobalPolicy(): Promise<RetentionPolicy> {
    try {
      const policy = AppDataSource.getRepository(RetentionPolicy).create({
        camera: null,
        alerts_days: this.DEFAULT_RETENTION_DAYS.alerts,
        detections_days: this.DEFAULT_RETENTION_DAYS.detections,
        previews_days: this.DEFAULT_RETENTION_DAYS.previews,
        snapshots_days: this.DEFAULT_RETENTION_DAYS.snapshots,
        events_days: this.DEFAULT_RETENTION_DAYS.events,
        retain_indefinitely: false,
      });

      return await AppDataSource.getRepository(RetentionPolicy).save(policy);
    } catch (error) {
      console.error('Error creating global retention policy:', error);
      throw error;
    }
  }

  async getPolicy(camera?: string): Promise<RetentionPolicy> {
    try {
      const cacheKey = camera || 'global';
      const cached = this.policyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.policy;
      }

      let policy = await AppDataSource.getRepository(RetentionPolicy)
        .createQueryBuilder('rp')
        .where('rp.camera = :camera', { camera: camera || null })
        .getOne();

      if (!policy) {
        if (this.creatingPolicy) {
          throw new Error('Re-entrant call to getPolicy detected');
        }
        this.creatingPolicy = true;
        try {
          policy = await this.createCameraPolicy(camera);
        } finally {
          this.creatingPolicy = false;
        }
      }

      this.policyCache.set(cacheKey, { policy, timestamp: Date.now() });
      return policy;
    } catch (error) {
      console.error(`Error retrieving retention policy for ${camera || 'global'}:`, error);
      throw error;
    }
  }

  async getAllPolicies(): Promise<RetentionPolicy[]> {
    try {
      return await AppDataSource.getRepository(RetentionPolicy)
        .createQueryBuilder('rp')
        .orderBy('rp.camera', 'ASC')
        .getMany();
    } catch (error) {
      console.error('Error retrieving all retention policies:', error);
      throw error;
    }
  }

  async createCameraPolicy(camera?: string): Promise<RetentionPolicy> {
    try {
      const globalPolicy = await AppDataSource.getRepository(RetentionPolicy)
        .createQueryBuilder('rp')
        .where('rp.camera IS NULL')
        .getOne();

      if (!globalPolicy) {
        const created = await this.createGlobalPolicy();
        const policy = AppDataSource.getRepository(RetentionPolicy).create({
          camera: camera || null,
          alerts_days: created.alerts_days,
          detections_days: created.detections_days,
          previews_days: created.previews_days,
          snapshots_days: created.snapshots_days,
          events_days: created.events_days,
          retain_indefinitely: created.retain_indefinitely,
        });
        return await AppDataSource.getRepository(RetentionPolicy).save(policy);
      }

      const policy = AppDataSource.getRepository(RetentionPolicy).create({
        camera: camera || null,
        alerts_days: globalPolicy.alerts_days,
        detections_days: globalPolicy.detections_days,
        previews_days: globalPolicy.previews_days,
        snapshots_days: globalPolicy.snapshots_days,
        events_days: globalPolicy.events_days,
        retain_indefinitely: globalPolicy.retain_indefinitely,
      });

      return await AppDataSource.getRepository(RetentionPolicy).save(policy);
    } catch (error) {
      console.error(`Error creating retention policy for ${camera || 'global'}:`, error);
      throw error;
    }
  }

  async updatePolicy(camera: string | null, config: Partial<RetentionConfig>): Promise<RetentionPolicy> {
    try {
      const policy = await this.getPolicy(camera || undefined);

      if (config.alertsDays !== undefined) policy.alerts_days = config.alertsDays;
      if (config.detectionsDays !== undefined) policy.detections_days = config.detectionsDays;
      if (config.previewsDays !== undefined) policy.previews_days = config.previewsDays;
      if (config.snapshotsDays !== undefined) policy.snapshots_days = config.snapshotsDays;
      if (config.eventsDays !== undefined) policy.events_days = config.eventsDays;
      if (config.retainIndefinitely !== undefined) policy.retain_indefinitely = config.retainIndefinitely;

      const updatedPolicy = await AppDataSource.getRepository(RetentionPolicy).save(policy);

      this.emit('policyUpdated', { camera: camera || 'global', policy: updatedPolicy });

      return updatedPolicy;
    } catch (error) {
      console.error(`Error updating retention policy for ${camera || 'global'}:`, error);
      throw error;
    }
  }

  async deletePolicy(camera: string): Promise<void> {
    try {
      await AppDataSource.getRepository(RetentionPolicy)
        .createQueryBuilder('rp')
        .delete()
        .where('rp.camera = :camera', { camera })
        .execute();

      this.emit('policyDeleted', { camera });
    } catch (error) {
      console.error(`Error deleting retention policy for ${camera}:`, error);
      throw error;
    }
  }

  async getExpiredFiles(camera?: string, category?: string): Promise<string[]> {
    try {
      const policy = await this.getPolicy(camera);

      if (policy.retain_indefinitely) {
        return [];
      }

      const retentionDays = this.getRetentionDaysForCategory(policy, category);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const expiredFiles: string[] = [];

      if (category === 'alerts' || !category) {
        expiredFiles.push(...await this.findExpiredFiles('alerts', camera, cutoffDate));
      }

      if (category === 'detections' || !category) {
        expiredFiles.push(...await this.findExpiredFiles('detections', camera, cutoffDate));
      }

      if (category === 'previews' || !category) {
        expiredFiles.push(...await this.findExpiredFiles('previews', camera, cutoffDate));
      }

      if (category === 'snapshots' || !category) {
        expiredFiles.push(...await this.findExpiredFiles('snapshots', camera, cutoffDate));
      }

      if (category === 'events' || !category) {
        expiredFiles.push(...await this.findExpiredFiles('events', camera, cutoffDate));
      }

      return expiredFiles;
    } catch (error) {
      console.error(`Error finding expired files for ${camera || 'global'}/${category || 'all'}:`, error);
      throw error;
    }
  }

  private getRetentionDaysForCategory(policy: RetentionPolicy, category?: string): number {
    switch (category) {
      case 'alerts':
        return policy.alerts_days;
      case 'detections':
        return policy.detections_days;
      case 'previews':
        return policy.previews_days;
      case 'snapshots':
        return policy.snapshots_days;
      case 'events':
        return policy.events_days;
      default:
        return Math.min(
          policy.alerts_days,
          policy.detections_days,
          policy.previews_days,
          policy.snapshots_days,
          policy.events_days
        );
    }
  }

  private async findExpiredFiles(category: string, camera: string | undefined, cutoffDate: Date): Promise<string[]> {
    const expiredFiles: string[] = [];
    const detectionsDir = process.env.DETECTIONS_DIR || '/app/data/detections';

    if (category !== 'detections' && category !== 'events') {
      const categoryPath = this.getCategoryPath(category, camera, detectionsDir);
      try {
        await fs.access(categoryPath);
      } catch {
        return expiredFiles;
      }
      try {
        const files = await this.scanDirectory(categoryPath);
        for (const file of files) {
          if (file.mtime < cutoffDate) {
            expiredFiles.push(file.path);
          }
        }
      } catch (error) {
        console.warn(`Error scanning ${category} directory for ${camera || 'global'}:`, error);
      }
      return expiredFiles;
    }

    try {
      const entries = await fs.readdir(detectionsDir, { withFileTypes: true });
      const monthDirs = entries
        .filter(e => e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name))
        .map(e => e.name);

      for (const monthDir of monthDirs) {
        const scanPath = path.join(detectionsDir, monthDir);
        const files = await this.scanDirectory(scanPath, 4);

        for (const file of files) {
          if (file.mtime < cutoffDate) {
            if (camera) {
              const basename = path.basename(file.path);
              if (!basename.includes(`_${camera}_`) && !basename.includes(`_${camera}`)) continue;
            }
            expiredFiles.push(file.path);
          }
        }
      }
    } catch (error) {
      console.warn(`Error scanning detections for ${camera || 'global'}:`, error);
    }

    return expiredFiles;
  }

  private getCategoryPath(category: string, camera: string | undefined, baseDir: string): string {
    switch (category) {
      case 'alerts':
        return path.join(baseDir, 'alerts');
      case 'snapshots':
        return path.join(baseDir, 'snapshots');
      case 'previews':
        return path.join(baseDir, 'previews');
      case 'detections':
      case 'events':
        return baseDir;
      default:
        return path.join(baseDir, category);
    }
  }

  private async scanDirectory(dirPath: string, maxDepth = 3): Promise<Array<{ path: string; mtime: Date }>> {
    const files: Array<{ path: string; mtime: Date }> = [];

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
              path: fullPath,
              mtime: stats.mtime,
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

  // Only used by cleanup job - not cached, runs at 3AM
  async getRetentionSummary(camera?: string): Promise<{
    policy: RetentionPolicy;
    expiredCounts: { [key: string]: number };
    totalExpiredFiles: number;
  }> {
    try {
      const policy = await this.getPolicy(camera);
      const expiredCounts: { [key: string]: number } = {};
      let totalExpiredFiles = 0;

      const categories = ['alerts', 'detections', 'previews', 'snapshots', 'events'];

      for (const category of categories) {
        const expiredFiles = await this.getExpiredFiles(camera, category);
        expiredCounts[category] = expiredFiles.length;
        totalExpiredFiles += expiredFiles.length;
      }

      return {
        policy,
        expiredCounts,
        totalExpiredFiles,
      };
    } catch (error) {
      console.error(`Error getting retention summary for ${camera || 'global'}:`, error);
      throw error;
    }
  }

  async applyRetentionPolicy(camera?: string, category?: string): Promise<number> {
    try {
      const expiredFiles = await this.getExpiredFiles(camera, category);
      let deletedCount = 0;

      for (const filePath of expiredFiles) {
        try {
          await fs.unlink(filePath);
          deletedCount++;
        } catch (error) {
          console.warn(`Error deleting expired file ${filePath}:`, error);
        }
      }

      if (deletedCount > 0) {
        this.emit('retentionApplied', { camera: camera || 'global', category: category || 'all', deletedCount });
      }

      return deletedCount;
    } catch (error) {
      console.error(`Error applying retention policy for ${camera || 'global'}/${category || 'all'}:`, error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const retentionPolicyService = RetentionPolicyService.getInstance();
export default retentionPolicyService;
