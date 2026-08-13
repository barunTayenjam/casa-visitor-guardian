import { AppDataSource } from '../database.js';
import { logger } from '../utils/logger.js';
import type { CameraConfig } from '../config/index.js';

export class CameraPersistence {
  async persist(cameras: CameraConfig[]): Promise<void> {
    if (!AppDataSource.isInitialized) return;

    for (const cfg of cameras) {
      const enabled = cfg.enabled !== false;
      await AppDataSource.query(
        `INSERT INTO cameras (id, name, config, enabled)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (id) DO UPDATE SET name = $2, config = $3::jsonb, enabled = $4`,
        [cfg.id, cfg.name, JSON.stringify(cfg), enabled],
      );
    }

    const currentIds = cameras.map((c) => c.id);
    if (currentIds.length > 0) {
      const placeholders = currentIds.map((_, i) => `$${i + 1}`).join(', ');
      await AppDataSource.query(
        `DELETE FROM cameras WHERE id NOT IN (${placeholders})`,
        currentIds,
      );
    }
    logger.info(`Camera config persisted to database (${cameras.length} cameras)`, 'StreamManager');
  }

  async load(): Promise<CameraConfig[]> {
    if (!AppDataSource.isInitialized) return [];
    const rows = await AppDataSource.query(
      'SELECT id, name, config, enabled FROM cameras ORDER BY created_at',
    );
    if (rows.length === 0) return [];
    logger.info(`Loaded ${rows.length} cameras from database`, 'StreamManager');
    return rows.map((row: any) => {
      const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      return { ...cfg, enabled: row.enabled };
    });
  }

  async deleteCamera(cameraId: string): Promise<void> {
    await AppDataSource.query('DELETE FROM cameras WHERE id = $1', [cameraId]);
  }
}

export const optimalFpsForViewers = (viewerCount: number): number => {
  if (viewerCount === 0) return 1;
  if (viewerCount <= 3) return 4;
  if (viewerCount <= 10) return 3;
  if (viewerCount <= 20) return 2;
  return 1;
};
