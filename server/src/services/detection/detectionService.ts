import { Repository } from 'typeorm';
import { DetectionConfig } from '../models/DetectionConfig.js';
import { cacheService } from './cacheService.js';

interface ThresholdConfig {
  min_score: number;
  threshold: number;
}

interface ScoreHistory {
  scores: number[];
  median: number;
  add(score: number): number;
}

const DEFAULT_THRESHOLDS: Record<string, ThresholdConfig> = {
  person: { min_score: 0.3, threshold: 0.5 },
  car: { min_score: 0.4, threshold: 0.6 },
  dog: { min_score: 0.3, threshold: 0.4 },
  package: { min_score: 0.25, threshold: 0.35 },
  cat: { min_score: 0.3, threshold: 0.45 },
  bicycle: { min_score: 0.35, threshold: 0.55 },
  motorcycle: { min_score: 0.35, threshold: 0.55 },
  truck: { min_score: 0.4, threshold: 0.6 },
  bus: { min_score: 0.4, threshold: 0.6 },
};

const DEFAULT_LABELMAP: Record<string, string> = {
  truck: 'car',
  bus: 'car',
  motorcycle: 'car',
  bicycle: 'person',
};

const CACHE_TTL = 3600;

export class DetectionService {
  private scoreHistories = new Map<string, ScoreHistory>();

  constructor(
    private readonly configRepo: Repository<DetectionConfig>,
  ) {}

  async getConfig(camera?: string): Promise<{
    thresholds: Record<string, ThresholdConfig>;
    labelmap: Record<string, string>;
    score_history_length: number;
  }> {
    const cacheKey = `detection:config:${camera || 'global'}`;
    const cached = await cacheService.getJSON(cacheKey);
    if (cached) return cached;

    let config: DetectionConfig | null = null;

    if (camera) {
      config = await this.configRepo.findOne({ where: { camera } });
    }

    if (!config) {
      config = await this.configRepo.findOne({ where: { camera: null } });
    }

    const result = {
      thresholds: config?.config?.thresholds || DEFAULT_THRESHOLDS,
      labelmap: config?.config?.labelmap || DEFAULT_LABELMAP,
      score_history_length: config?.config?.score_history_length || 7,
    };

    await cacheService.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  async updateConfig(
    camera: string | null,
    config: Partial<{
      thresholds: Record<string, ThresholdConfig>;
      labelmap: Record<string, string>;
      score_history_length: number;
    }>
  ): Promise<void> {
    let existing = camera
      ? await this.configRepo.findOne({ where: { camera } })
      : await this.configRepo.findOne({ where: { camera: null } });

    const currentConfig = existing?.config || {
      thresholds: DEFAULT_THRESHOLDS,
      labelmap: DEFAULT_LABELMAP,
      score_history_length: 7,
    };

    const newConfig = {
      ...currentConfig,
      ...config,
      last_updated: new Date().toISOString(),
    };

    if (existing) {
      await this.configRepo.update(existing.id, {
        config: newConfig,
        updated_at: new Date(),
      });
    } else {
      await this.configRepo.save({
        camera,
        config: newConfig,
      });
    }

    await cacheService.del('detection:config:*');
  }

  filterDetections(
    detections: Array<{
      label: string;
      score: number;
      object_id?: string;
    }>,
    camera?: string
  ): Array<{
    label: string;
    score: number;
    object_id?: string;
    filtered: boolean;
    reason?: string;
  }> {
    const config = this.getConfigSync(camera);
    const result: Array<{
      label: string;
      score: number;
      object_id?: string;
      filtered: boolean;
      reason?: string;
    }> = [];

    for (const detection of detections) {
      const mappedLabel = config.labelmap[detection.label] || detection.label;
      const threshold = config.thresholds[mappedLabel] || config.thresholds[detection.label];

      if (!threshold) {
        result.push({ ...detection, label: mappedLabel, filtered: false });
        continue;
      }

      const objectKey = detection.object_id || detection.label;
      let history = this.scoreHistories.get(objectKey);
      if (!history) {
        history = this.createScoreHistory(config.score_history_length);
        this.scoreHistories.set(objectKey, history);
      }

      const medianScore = history.add(detection.score);

      if (medianScore < threshold.min_score) {
        result.push({
          ...detection,
          label: mappedLabel,
          score: medianScore,
          filtered: true,
          reason: 'below_min_score',
        });
      } else {
        result.push({
          ...detection,
          label: mappedLabel,
          score: medianScore,
          filtered: false,
        });
      }
    }

    return result.filter(d => !d.filtered);
  }

  private getConfigSync(camera?: string): {
    thresholds: Record<string, ThresholdConfig>;
    labelmap: Record<string, string>;
    score_history_length: number;
  } {
    return {
      thresholds: DEFAULT_THRESHOLDS,
      labelmap: DEFAULT_LABELMAP,
      score_history_length: 7,
    };
  }

  private createScoreHistory(maxLength: number): ScoreHistory {
    const scores: number[] = [];

    return {
      scores,
      get median() {
        if (scores.length === 0) return 0;
        const sorted = [...scores].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      },
      add(score: number) {
        scores.push(score);
        if (scores.length > maxLength) {
          scores.shift();
        }
        return this.median;
      },
    };
  }

  clearScoreHistory(objectId?: string): void {
    if (objectId) {
      this.scoreHistories.delete(objectId);
    } else {
      this.scoreHistories.clear();
    }
  }

  getScoreHistory(objectId: string): number[] {
    return this.scoreHistories.get(objectId)?.scores || [];
  }
}

export const detectionService = new DetectionService(
  {} as Repository<DetectionConfig>
);
