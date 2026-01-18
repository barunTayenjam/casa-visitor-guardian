import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimelineService } from '../timelineService.js';

describe('TimelineService', () => {
  let timelineService: TimelineService;
  let mockTimelineRepo: any;
  let mockRegionRepo: any;

  beforeEach(() => {
    mockTimelineRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      }),
      create: vi.fn(),
      save: vi.fn(),
    };

    mockRegionRepo = {
      findOne: vi.fn(),
      update: vi.fn(),
      save: vi.fn(),
    };

    timelineService = new TimelineService(mockTimelineRepo, mockRegionRepo);
  });

  describe('getTimeline', () => {
    it('should return empty events when no data exists', async () => {
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      const result = await timelineService.getTimeline({});

      expect(result.events).toEqual([]);
      expect(result.summary).toEqual({});
    });

    it('should return events with summary', async () => {
      const mockEvents = [
        { id: 'tl_1', source: 'tracked_object', class_type: 'person', data: {} },
        { id: 'tl_2', source: 'tracked_object', class_type: 'car', data: {} },
        { id: 'tl_3', source: 'tracked_object', class_type: 'person', data: {} },
      ];
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue(mockEvents);

      const result = await timelineService.getTimeline({});

      expect(result.events).toHaveLength(3);
      expect(result.summary).toEqual({
        'tracked_object:person': 2,
        'tracked_object:car': 1,
      });
    });

    it('should apply camera filter', async () => {
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      await timelineService.getTimeline({ camera: 'front_door' });

      expect(mockTimelineRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
        'timeline.camera = :camera',
        { camera: 'front_door' }
      );
    });

    it('should apply sources filter', async () => {
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      await timelineService.getTimeline({ sources: ['tracked_object', 'audio'] });

      expect(mockTimelineRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
        'timeline.source IN (:...sources)',
        { sources: ['tracked_object', 'audio'] }
      );
    });
  });

  describe('getActiveObjects', () => {
    it('should return active objects within timeout', async () => {
      const now = Date.now();
      const mockEvents = [
        {
          id: 'tl_1',
          data: { object_id: 'person_1', label: 'person', score: 0.9 },
          timestamp: new Date(now - 5000),
        },
        {
          id: 'tl_2',
          data: { object_id: 'person_1', label: 'person', score: 0.85 },
          timestamp: new Date(now - 2000),
        },
      ];
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue(mockEvents);

      const result = await timelineService.getActiveObjects('cam1');

      expect(result.has('person_1')).toBe(true);
      expect(result.get('person_1')?.label).toBe('person');
      expect(result.get('person_1')?.score).toBe(0.85);
    });

    it('should return empty map when no recent events', async () => {
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      const result = await timelineService.getActiveObjects('cam1');

      expect(result.size).toBe(0);
    });
  });

  describe('addTimelineEvent', () => {
    it('should create timeline event with generated ID', async () => {
      mockTimelineRepo.create.mockReturnValue({ id: '', save: vi.fn() });
      mockTimelineRepo.save.mockResolvedValue({});
      mockRegionRepo.findOne.mockResolvedValue(null);
      mockRegionRepo.save.mockResolvedValue({});

      const event = {
        timestamp: new Date(),
        camera: 'cam1',
        source: 'tracked_object',
        sourceId: 'obj_1',
        classType: 'person',
        data: { object_id: 'obj_1', label: 'person', score: 0.9 },
      };

      const result = await timelineService.addTimelineEvent(event);

      expect(result.id).toMatch(/^tl_/);
      expect(mockTimelineRepo.create).toHaveBeenCalled();
      expect(mockTimelineRepo.save).toHaveBeenCalled();
    });
  });

  describe('getAdaptiveRegions', () => {
    it('should return existing regions', async () => {
      mockRegionRepo.findOne.mockResolvedValue({
        camera: 'cam1',
        grid: { cells: ['0,0', '1,1'], last_update: '2024-01-15T10:00:00Z' },
      });

      const result = await timelineService.getAdaptiveRegions('cam1');

      expect(result.cells).toEqual(['0,0', '1,1']);
      expect(result.last_update).toBe('2024-01-15T10:00:00Z');
    });

    it('should return default regions when none exist', async () => {
      mockRegionRepo.findOne.mockResolvedValue(null);

      const result = await timelineService.getAdaptiveRegions('cam1');

      expect(result.cells).toEqual([]);
      expect(result.last_update).toBeNull();
    });
  });

  describe('updateAdaptiveRegions', () => {
    it('should add new cell to grid', async () => {
      mockRegionRepo.findOne.mockResolvedValue({
        camera: 'cam1',
        grid: { cells: ['0,0'], last_update: null },
      });
      mockRegionRepo.update.mockResolvedValue({});

      await (timelineService as any).updateAdaptiveRegions('cam1', {
        box: { x: 32, y: 32, width: 64, height: 64 },
      });

      expect(mockRegionRepo.update).toHaveBeenCalledWith(
        'cam1',
        expect.objectContaining({
          grid: expect.objectContaining({
            cells: expect.arrayContaining(['0,0', '0,0']),
          }),
        })
      );
    });

    it('should create new grid if none exists', async () => {
      mockRegionRepo.findOne.mockResolvedValue(null);
      mockRegionRepo.save.mockResolvedValue({});

      await (timelineService as any).updateAdaptiveRegions('cam1', {
        box: { x: 32, y: 32, width: 64, height: 64 },
      });

      expect(mockRegionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          camera: 'cam1',
          grid: expect.objectContaining({
            cells: expect.arrayContaining(['0,0']),
          }),
        })
      );
    });
  });

  describe('clearAdaptiveRegions', () => {
    it('should reset grid to empty cells', async () => {
      mockRegionRepo.update.mockResolvedValue({});

      await timelineService.clearAdaptiveRegions('cam1');

      expect(mockRegionRepo.update).toHaveBeenCalledWith('cam1', {
        grid: { cells: [], last_update: expect.any(String) },
        last_update: expect.any(Date),
      });
    });
  });
});
