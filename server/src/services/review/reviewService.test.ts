import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewService } from '../reviewService.js';

describe('ReviewService', () => {
  let reviewService: ReviewService;
  let mockReviewSegmentRepo: any;
  let mockReviewStatusRepo: any;
  let mockTimelineService: any;
  let mockPreviewService: any;

  beforeEach(() => {
    mockReviewSegmentRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      }),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    mockReviewStatusRepo = {
      findOne: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    mockTimelineService = {
      getActiveObjects: vi.fn().mockResolvedValue(new Map()),
    };

    mockPreviewService = {
      generatePreview: vi.fn().mockResolvedValue('/path/to/preview.mp4'),
    };

    reviewService = new ReviewService(
      mockReviewSegmentRepo,
      mockReviewStatusRepo,
      mockTimelineService,
      mockPreviewService
    );
  });

  describe('getReviewSegments', () => {
    it('should return empty segments when no data exists', async () => {
      mockReviewSegmentRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0]);

      const result = await reviewService.getReviewSegments({});

      expect(result.segments).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return segments with pagination', async () => {
      const mockSegments = [
        { id: 'segment_1', camera: 'cam1', severity: 'alert' },
        { id: 'segment_2', camera: 'cam1', severity: 'detection' },
      ];
      mockReviewSegmentRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([mockSegments, 5]);

      const result = await reviewService.getReviewSegments({ limit: 2 });

      expect(result.segments).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('should apply camera filter', async () => {
      mockReviewSegmentRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0]);

      await reviewService.getReviewSegments({ camera: 'front_door' });

      expect(mockReviewSegmentRepo.createQueryBuilder).toHaveBeenCalledWith('segment');
      expect(mockReviewSegmentRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
        'segment.camera = :camera',
        { camera: 'front_door' }
      );
    });

    it('should apply severity filter', async () => {
      mockReviewSegmentRepo.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0]);

      await reviewService.getReviewSegments({ severity: 'alert' });

      expect(mockReviewSegmentRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
        'segment.severity = :severity',
        { severity: 'alert' }
      );
    });
  });

  describe('calculateSeverity', () => {
    it('should return alert for person detection', () => {
      const objects = new Map([['person_1', { label: 'person', lastSeen: new Date(), score: 0.9 }]]);
      const severity = (reviewService as any).calculateSeverity(objects);
      expect(severity).toBe('alert');
    });

    it('should return alert for car detection', () => {
      const objects = new Map([['car_1', { label: 'car', lastSeen: new Date(), score: 0.85 }]]);
      const severity = (reviewService as any).calculateSeverity(objects);
      expect(severity).toBe('alert');
    });

    it('should return detection for dog detection', () => {
      const objects = new Map([['dog_1', { label: 'dog', lastSeen: new Date(), score: 0.8 }]]);
      const severity = (reviewService as any).calculateSeverity(objects);
      expect(severity).toBe('detection');
    });
  });

  describe('bundleObjects', () => {
    it('should create single bundle for contiguous objects', () => {
      const now = new Date();
      const objects = new Map([
        ['obj_1', { label: 'person', lastSeen: now, score: 0.9 }],
        ['obj_2', { label: 'person', lastSeen: new Date(now.getTime() + 5000), score: 0.85 }],
      ]);

      const bundles = (reviewService as any).bundleObjects(objects);

      expect(bundles).toHaveLength(1);
      expect(bundles[0].objects.size).toBe(2);
    });

    it('should split bundles when gap exceeds threshold', () => {
      const now = new Date();
      const objects = new Map([
        ['obj_1', { label: 'person', lastSeen: now, score: 0.9 }],
        ['obj_2', { label: 'person', lastSeen: new Date(now.getTime() + 60000), score: 0.85 }],
      ]);

      const bundles = (reviewService as any).bundleObjects(objects);

      expect(bundles).toHaveLength(2);
    });

    it('should return empty array for empty objects', () => {
      const objects = new Map();
      const bundles = (reviewService as any).bundleObjects(objects);
      expect(bundles).toEqual([]);
    });
  });

  describe('generateSegmentId', () => {
    it('should generate unique segment ID', () => {
      const startTime = new Date('2024-01-15T10:30:00Z');
      const id1 = (reviewService as any).generateSegmentId(startTime, 'cam1');
      const id2 = (reviewService as any).generateSegmentId(startTime, 'cam1');

      expect(id1).toMatch(/^segment_cam1_/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('acknowledgeSegment', () => {
    it('should create new review status if not exists', async () => {
      mockReviewStatusRepo.findOne.mockResolvedValue(null);
      mockReviewStatusRepo.save.mockResolvedValue({});

      await reviewService.acknowledgeSegment('segment_1', 'user_1');

      expect(mockReviewStatusRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_1',
          review_segment_id: 'segment_1',
          has_been_reviewed: true,
        })
      );
    });

    it('should update existing review status', async () => {
      mockReviewStatusRepo.findOne.mockResolvedValue({
        user_id: 'user_1',
        review_segment_id: 'segment_1',
        has_been_reviewed: false,
      });
      mockReviewStatusRepo.update.mockResolvedValue({});

      await reviewService.acknowledgeSegment('segment_1', 'user_1');

      expect(mockReviewStatusRepo.update).toHaveBeenCalled();
    });
  });
});
