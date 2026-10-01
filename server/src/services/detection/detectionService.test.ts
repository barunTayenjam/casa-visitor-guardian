import { describe, it, expect, beforeEach, jest } from '@jest/globals';
// @ts-expect-error — jest module mock breaks import typing
import { DetectionService } from './detectionService.js';

describe('DetectionService', () => {
  let detectionService: DetectionService;
  let mockConfigRepo: any;

  beforeEach(() => {
    mockConfigRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    };

    detectionService = new DetectionService(mockConfigRepo);
  });

  describe('getConfig', () => {
    it('should return default config when no database config exists', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);

      const result = await detectionService.getConfig();

      expect(result.thresholds).toBeDefined();
      expect(result.thresholds.person).toEqual({ min_score: 0.3, threshold: 0.5 });
      expect(result.labelmap).toBeDefined();
      expect(result.labelmap.truck).toBe('car');
      expect(result.score_history_length).toBe(7);
    });

    it('should return camera-specific config when exists', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        camera: 'front_door',
        config: {
          thresholds: { person: { min_score: 0.5, threshold: 0.7 } },
          labelmap: { truck: 'vehicle' },
          score_history_length: 10,
        },
      });

      const result = await detectionService.getConfig('front_door');

      expect(result.thresholds.person.min_score).toBe(0.5);
      expect(result.labelmap.truck).toBe('vehicle');
      expect(result.score_history_length).toBe(10);
    });

    it('should fall back to global config when camera config not found', async () => {
      mockConfigRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'uuid-2',
        camera: null,
        config: {
          thresholds: { person: { min_score: 0.4, threshold: 0.6 } },
          labelmap: {},
          score_history_length: 5,
        },
      });

      const result = await detectionService.getConfig('back_door');

      expect(result.thresholds.person.min_score).toBe(0.4);
      expect(result.score_history_length).toBe(5);
    });
  });

  describe('updateConfig', () => {
    it('should create new config when none exists', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);
      mockConfigRepo.save.mockResolvedValue({});

      await detectionService.updateConfig(null, {
        thresholds: { person: { min_score: 0.35, threshold: 0.55 } },
      });

      expect(mockConfigRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          camera: null,
          config: expect.objectContaining({
            thresholds: expect.objectContaining({
              person: { min_score: 0.35, threshold: 0.55 },
            }),
          }),
        }),
      );
    });

    it('should update existing global config', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        id: 'uuid-1',
        camera: null,
        config: { thresholds: {}, labelmap: {}, score_history_length: 7 },
      });
      mockConfigRepo.update.mockResolvedValue({});

      await detectionService.updateConfig(null, {
        labelmap: { truck: 'vehicle' },
      });

      expect(mockConfigRepo.update).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({
          config: expect.objectContaining({
            labelmap: { truck: 'vehicle' },
          }),
        }),
      );
    });

    it('should update camera-specific config', async () => {
      mockConfigRepo.findOne.mockResolvedValue({
        id: 'uuid-2',
        camera: 'front_door',
        config: { thresholds: {}, labelmap: {}, score_history_length: 7 },
      });
      mockConfigRepo.update.mockResolvedValue({});

      await detectionService.updateConfig('front_door', {
        score_history_length: 10,
      });

      expect(mockConfigRepo.update).toHaveBeenCalledWith(
        'uuid-2',
        expect.objectContaining({
          config: expect.objectContaining({
            score_history_length: 10,
          }),
        }),
      );
    });
  });

  describe('clearScoreHistory', () => {
    it('should clear all history when no objectId provided', () => {
      detectionService.clearScoreHistory();
      expect((detectionService as any).scoreHistories.size).toBe(0);
    });

    it('should clear specific object history', () => {
      (detectionService as any).scoreHistories.set('obj1', { scores: [1, 2, 3] });
      (detectionService as any).scoreHistories.set('obj2', { scores: [4, 5, 6] });

      detectionService.clearScoreHistory('obj1');

      expect((detectionService as any).scoreHistories.has('obj1')).toBe(false);
      expect((detectionService as any).scoreHistories.has('obj2')).toBe(true);
    });
  });

  describe('getScoreHistory', () => {
    it('should return empty array for unknown object', () => {
      const result = detectionService.getScoreHistory('unknown');
      expect(result).toEqual([]);
    });

    it('should return score history for known object', () => {
      (detectionService as any).scoreHistories.set('obj1', {
        scores: [0.5, 0.6, 0.7],
        get median() {
          return this.scores[1];
        },
        add() {
          return this.median;
        },
      });

      const result = detectionService.getScoreHistory('obj1');

      expect(result).toEqual([0.5, 0.6, 0.7]);
    });
  });
});
