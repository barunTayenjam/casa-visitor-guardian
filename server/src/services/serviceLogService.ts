import { AppDataSource } from '../database.js';
import { ServiceLog } from '../models/ServiceLog.js';

export interface ServiceLogEntry {
  service: string;
  level: 'info' | 'warn' | 'error';
  module?: string;
  cameraId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface QueryFilters {
  service?: string;
  level?: string;
  cameraId?: string;
  since?: Date;
  limit?: number;
}

const FLUSH_INTERVAL_MS = 2000;
const FLUSH_THRESHOLD = 50;
const QUEUE_CAP = 1000;

class ServiceLogService {
  private queue: ServiceLogEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  recordLog(entry: ServiceLogEntry): void {
    try {
      if (!entry.message) return;
      this.queue.push(entry);
      if (this.queue.length > QUEUE_CAP) {
        this.queue.splice(0, this.queue.length - QUEUE_CAP);
      }
      if (this.queue.length >= FLUSH_THRESHOLD) {
        void this.flush();
      } else if (!this.timer) {
        this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
        this.timer.unref?.();
      }
    } catch {
      // logging must never break the app
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, 50);
        const rows = batch.map((e) => ({
          service: e.service,
          level: e.level,
          module: e.module ?? undefined,
          cameraId: e.cameraId ?? undefined,
          message: e.message.slice(0, 8000),
          metadata: e.metadata ?? undefined,
        }));
        await AppDataSource.getRepository(ServiceLog).insert(rows);
      }
    } catch {
      // drop on failure — persistent logging is best-effort
    } finally {
      this.flushing = false;
    }
  }

  async queryLogs(filters: QueryFilters): Promise<ServiceLog[]> {
    const repo = AppDataSource.getRepository(ServiceLog);
    const qb = repo
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .take(Math.min(Math.max(filters.limit ?? 100, 1), 500));

    if (filters.service) qb.andWhere('log.service = :service', { service: filters.service });
    if (filters.level) qb.andWhere('log.level = :level', { level: filters.level });
    if (filters.cameraId) qb.andWhere('log.camera_id = :cameraId', { cameraId: filters.cameraId });
    if (filters.since) qb.andWhere('log.timestamp >= :since', { since: filters.since });

    return qb.getMany();
  }

  async purgeOlderThanDays(days: number): Promise<number> {
    const repo = AppDataSource.getRepository(ServiceLog);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await repo
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }
}

export const serviceLogService = new ServiceLogService();
