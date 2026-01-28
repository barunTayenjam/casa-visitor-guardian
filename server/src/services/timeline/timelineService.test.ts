import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TimelineService } from './timelineService.js';

jest.mock('../models/Timeline.js');
jest.mock('../models/AdaptiveRegion.js');
jest.mock('./cacheService.js');

describe('TimelineService', () => {
  let timelineService: TimelineService;
  let mockTimelineRepo: any;
  let mockRegionRepo: any;

  beforeEach(() => {
    mockTimelineRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    mockRegionRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    };

    const TimelineService = require('./timelineService.js').TimelineService;
    timelineService = new TimelineService(mockTimelineRepo, mockRegionRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTimeline', () => {
    it('should return empty timeline when no events', async () => {
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      const result = await timelineService.getTimeline({});

      expect(result.events).toEqual([]);
      expect(result.summary).toEqual({});
    });

    it('should filter by camera', async () => {
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue([
        { id: '1', source: 'tracked_object', class_type: 'person', data: {}, timestamp: new Date() }
      ]);

      const result = await timelineService.getTimeline({ camera: 'front_door' });

      expect(mockTimelineRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
        'timeline.camera = :camera',
        { camera: 'front_door' }
      );
      expect(result.events).toHaveLength(1);
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const result = await timelineService.getTimeline({ 
        after: startDate, 
        before: endDate 
      });

      expect(mockTimelineRepo.createQueryBuilder().where).toHaveBeenCalledWith(
        'timeline.timestamp >= :after',
        { after: startDate }
      );
      expect(mockTimelineRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
        'timeline.timestamp <= :before',
        { before: endDate }
      );
    });

    it('should limit results', async () => {
      mockTimelineRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      const result = await timelineService.getTimeline({ limit: 50 });

      expect(mockTimelineRepo.createQueryBuilder().limit).toHaveBeenCalledWith(50);
    });
  });

  describe('addTimelineEvent', () => {
    it('should create event with generated ID', async () => {
      const mockEvent = { id: '', save: jest.fn() };
      mockTimelineRepo.create.mockReturnValue(mockEvent);
      mockTimelineRepo.save.mockResolvedValue({} as any);
      mockRegionRepo.findOne.mockResolvedValue(null as any);
      mockRegionRepo.save.mockResolvedValue({} as any);

      const event = {
        timestamp: new Date(),
        camera: 'cam1',
        source: 'tracked_object',
        sourceId: 'obj_1',
        classType: 'person',
        data: { object_id: 'obj_1', label: 'person', score: 0.9 },
      };

      const result = await timelineService.addTimelineEvent(event);

      expect(mockTimelineRepo.create).toHaveBeenCalled();
      expect(mockTimelineRepo.save).toHaveBeenCalled();
      expect(result.id).toMatch(/^tl_/);
    });

    it('should create adaptive region if none exists', async () => {
      mockRegionRepo.findOne.mockResolvedValue(null as any);
      mockRegionRepo.save.mockResolvedValue({} as any);

      const event = {
        timestamp: new Date(),
        camera: 'cam1',
        source: 'adaptive_region',
        sourceId: 'region_1',
        classType: 'region',
        data: { 
          box: { x: 0, y: 0, width: 640, height: 480 },
          grid: { cells: ['0,0', '0,1'] }
        },
      };

      await timelineService.addTimelineEvent(event);

      expect(mockRegionRepo.save).toHaveBeenCalled();
    });
  });

  describe('getAdaptiveRegions', () => {
    it('should return existing regions', async () => {
      mockRegionRepo.findOne.mockResolvedValue({
        camera: 'cam1',
        grid: { cells: ['0,0', '1,1'], last_update: '2024-01-15T10:00:00Z' },
      } as any);

      const result = await timelineService.getAdaptiveRegions('cam1');

      expect(result.cells).toEqual(['0,0', '1,1']);
      expect(result.last_update).toBe('2024-01-15T10:00:00Z');
    });

    it('should return default regions when none exist', async () => {
      mockRegionRepo.findOne.mockResolvedValue(null as any);

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
      } as any);
      mockRegionRepo.update.mockResolvedValue({} as any);

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
      mockRegionRepo.findOne.mockResolvedValue(null as any);
      mockRegionRepo.save.mockResolvedValue({} as any);

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
      mockRegionRepo.update.mockResolvedValue({} as any);

      await timelineService.clearAdaptiveRegions('cam1');

      expect(mockRegionRepo.update).toHaveBeenCalledWith('cam1', {
        grid: { cells: [], last_update: expect.any(String) },
        last_update: expect.any(Date),
      });
    });
  });
});
