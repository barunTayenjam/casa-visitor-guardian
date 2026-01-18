import { Repository } from 'typeorm';
import { Timeline } from '../models/Timeline.js';
import { AdaptiveRegion } from '../models/AdaptiveRegion.js';
import { cacheService } from './cacheService.js';

interface TimelineEvent {
  id: string;
  timestamp: Date;
  camera: string;
  source: string;
  sourceId: string;
  classType: string;
  data: Record<string, unknown>;
}

interface TimelineQuery {
  camera?: string;
  after?: Date;
  before?: Date;
  sources?: string[];
  limit?: number;
}

interface ActiveObject {
  label: string;
  lastSeen: Date;
  score: number;
}

const ACTIVE_OBJECT_TIMEOUT_MS = 10000;
const CACHE_TTL = 300;

export class TimelineService {
  constructor(
    private readonly timelineRepo: Repository<Timeline>,
    private readonly regionRepo: Repository<AdaptiveRegion>,
  ) {}

  async getTimeline(query: TimelineQuery): Promise<{
    events: TimelineEvent[];
    summary: Record<string, number>;
  }> {
    const { camera, after, before, sources, limit = 1000 } = query;

    const queryBuilder = this.timelineRepo
      .createQueryBuilder('timeline')
      .where('timeline.timestamp >= :after', { after: after || new Date(Date.now() - 86400000) })
      .andWhere('timeline.timestamp <= :before', { before: before || new Date() });

    if (camera) {
      queryBuilder.andWhere('timeline.camera = :camera', { camera });
    }

    if (sources && sources.length > 0) {
      queryBuilder.andWhere('timeline.source IN (:...sources)', { sources });
    }

    const events = await queryBuilder
      .orderBy('timeline.timestamp', 'DESC')
      .limit(limit)
      .getMany();

    const resultEvents: TimelineEvent[] = events.map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      camera: event.camera,
      source: event.source,
      sourceId: event.source_id,
      classType: event.class_type,
      data: event.data,
    }));

    const summary: Record<string, number> = {};
    for (const event of events) {
      const key = `${event.source}:${event.class_type}`;
      summary[key] = (summary[key] || 0) + 1;
    }

    return { events: resultEvents, summary };
  }

  async getActiveObjects(camera: string): Promise<Map<string, ActiveObject>> {
    const cutoff = new Date(Date.now() - ACTIVE_OBJECT_TIMEOUT_MS);

    const events = await this.timelineRepo
      .createQueryBuilder('timeline')
      .where('timeline.camera = :camera', { camera })
      .andWhere('timeline.source = :source', { source: 'tracked_object' })
      .andWhere('timeline.timestamp >= :cutoff', { cutoff })
      .orderBy('timeline.timestamp', 'DESC')
      .getMany();

    const activeObjects = new Map<string, ActiveObject>();

    for (const event of events) {
      const data = event.data as { object_id?: string; label?: string; score?: number };
      if (!data.object_id) continue;

      const existing = activeObjects.get(data.object_id);
      if (!existing || event.timestamp > existing.lastSeen) {
        activeObjects.set(data.object_id, {
          label: data.label || event.class_type,
          lastSeen: event.timestamp,
          score: data.score || 0,
        });
      }
    }

    return activeObjects;
  }

  async addTimelineEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
    const id = `tl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    const timelineEvent = this.timelineRepo.create({
      id,
      timestamp: event.timestamp || new Date(),
      camera: event.camera,
      source: event.source as Timeline['source'],
      source_id: event.sourceId,
      class_type: event.classType,
      data: event.data,
    });

    await this.timelineRepo.save(timelineEvent);

    if (event.source === 'tracked_object') {
      await this.updateAdaptiveRegions(event.camera, event.data as { box?: { x: number; y: number; width: number; height: number } });
    }

    return { id, ...event };
  }

  async getAdaptiveRegions(camera: string): Promise<{ cells: string[]; last_update: string | null }> {
    const region = await this.regionRepo.findOne({ where: { camera } });
    return region?.grid || { cells: [], last_update: null };
  }

  async clearAdaptiveRegions(camera: string): Promise<void> {
    await this.regionRepo.update(camera, {
      grid: { cells: [], last_update: new Date().toISOString() },
      last_update: new Date(),
    });
  }

  private async updateAdaptiveRegions(
    camera: string,
    data: { box?: { x: number; y: number; width: number; height: number } }
  ): Promise<void> {
    if (!data.box) return;

    const region = await this.regionRepo.findOne({ where: { camera } });
    const grid = region?.grid || { cells: [], last_update: null };

    const cellX = Math.floor(data.box.x / 64);
    const cellY = Math.floor(data.box.y / 64);
    const key = `${cellX},${cellY}`;

    grid.cells = Array.from(new Set([...grid.cells, key]));
    grid.last_update = new Date().toISOString();

    if (region) {
      await this.regionRepo.update(camera, { grid, last_update: new Date() });
    } else {
      await this.regionRepo.save({ camera, grid, last_update: new Date() });
    }
  }
}
