import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

jest.unstable_mockModule('../database.js', () => ({
  AppDataSource: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const analyzeRelationsMock = jest.fn();
const analyzeRelationsWithSceneMock = jest.fn();
jest.unstable_mockModule('./relationsServiceClient.js', () => ({
  relationsServiceClient: {
    analyzeRelations: analyzeRelationsMock,
    analyzeRelationsWithScene: analyzeRelationsWithSceneMock,
  },
}));

const detectObjectsMock = jest.fn();
jest.unstable_mockModule('./opencvMicroserviceClient.js', () => ({
  getOpenCVClient: () => ({ detectObjects: detectObjectsMock }),
}));

describe('relationAnalysisService.getEventRelations', () => {
  let AppDataSource: { query: jest.Mock };
  let service: { getEventRelations(id: string): Promise<unknown> };

  beforeAll(async () => {
    const dbMod = await import('../database.js');
    AppDataSource = dbMod.AppDataSource;
    const mod = await import('./relationAnalysisService.js');
    service = mod.relationAnalysisService;
  });

  beforeEach(() => {
    AppDataSource.query.mockReset();
    analyzeRelationsMock.mockReset();
    detectObjectsMock.mockReset();
    analyzeRelationsWithSceneMock.mockReset();
    analyzeRelationsMock.mockResolvedValue({ relations: [], processingTimeMs: 300 });
  });

  it('rejects ids that are not uuids', async () => {
    await expect(service.getEventRelations('not-a-uuid')).rejects.toThrow('Invalid event id');
    expect(AppDataSource.query).not.toHaveBeenCalled();
  });

  it('returns null when the event does not exist', async () => {
    AppDataSource.query.mockResolvedValue([]);
    await expect(service.getEventRelations('11111111-1111-4111-8111-111111111111')).resolves.toBeNull();
  });

  it('serves legacy array relations from cache without boxes', async () => {
    const stored = [
      { subject: 'person', predicate: 'looking at', object: 'person', score: 0.68, subjectIndex: 0, objectIndex: 1 },
    ];
    AppDataSource.query.mockResolvedValue([
      { id: 'evt-1', file_path: '/app/data/detections/a.jpg', object_detections: [], relations: stored },
    ]);

    const result = (await service.getEventRelations('11111111-1111-4111-8111-111111111111')) as {
      source: string;
      relations: unknown[];
      boxes?: unknown;
    };

    expect(result.source).toBe('cache');
    expect(result.relations).toEqual(stored);
    expect(result.boxes).toBeUndefined();
    expect(analyzeRelationsMock).not.toHaveBeenCalled();
  });

  it('serves document relations from cache with boxes', async () => {
    const doc = {
      v: 1,
      boxes: [
        { x: 1, y: 2, width: 3, height: 4, class: 'person' },
        { x: 5, y: 6, width: 7, height: 8, class: 'car' },
      ],
      relations: [
        { subject: 'person', predicate: 'near', object: 'car', score: 0.5, subjectIndex: 0, objectIndex: 1 },
      ],
    };
    AppDataSource.query.mockResolvedValue([
      { id: 'evt-2', file_path: '/app/data/detections/a.jpg', object_detections: [], relations: doc },
    ]);

    const result = (await service.getEventRelations('22222222-2222-4222-8222-222222222222')) as {
      source: string;
      relations: unknown[];
      boxes?: unknown;
    };

    expect(result.source).toBe('cache');
    expect(result.relations).toEqual(doc.relations);
    expect(result.boxes).toEqual(doc.boxes);
  });

  it('negative-caches events without a snapshot as unavailable', async () => {
    AppDataSource.query.mockResolvedValue([
      { id: 'evt-3', file_path: null, object_detections: [{ bbox: { x: 1, y: 1, width: 5, height: 5 }, class: 'dog' }], relations: null },
    ]);

    const result = (await service.getEventRelations('33333333-3333-4333-8333-333333333333')) as {
      source: string;
      reason?: string;
    };

    expect(result.source).toBe('unavailable');
    expect(result.reason).toBe('no snapshot stored for this event');
    expect(detectObjectsMock).not.toHaveBeenCalled();

    const updateCall = AppDataSource.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).startsWith('UPDATE events SET relations'),
    );
    expect(JSON.parse(updateCall![1][0])).toEqual([]);
  });

  it('relates tracked detections directly when there are at least two', async () => {
    const computed = [
      { subject: 'person', predicate: 'looking at', object: 'person', score: 0.68, subjectIndex: 0, objectIndex: 1 },
    ];
    analyzeRelationsMock.mockResolvedValue({ relations: computed, processingTimeMs: 283 });
    const tracked = [
      { bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' },
      { bbox: { x: 500, y: 100, width: 100, height: 200 }, class: 'person' },
    ];
    AppDataSource.query.mockResolvedValue([
      { id: 'evt-4', file_path: '/app/data/detections/b.jpg', object_detections: tracked, relations: null },
    ]);

    const result = (await service.getEventRelations('44444444-4444-4444-8444-444444444444')) as {
      source: string;
      relations: unknown[];
      boxes?: unknown[];
    };

    expect(result.source).toBe('computed');
    expect(result.relations).toEqual(computed);
    expect(detectObjectsMock).not.toHaveBeenCalled();
    expect(analyzeRelationsMock).toHaveBeenCalledWith('/app/data/detections/b.jpg', [
      { bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' },
      { bbox: { x: 500, y: 100, width: 100, height: 200 }, class: 'person' },
    ]);
    expect(result.boxes).toHaveLength(2);

    const updateCall = AppDataSource.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).startsWith('UPDATE events SET relations'),
    );
    const persisted = JSON.parse(updateCall![1][0]);
    expect(persisted.v).toBe(1);
    expect(persisted.relations).toEqual(computed);
  });

  it('falls back to full-scene detection for single-object events', async () => {
    const computed = [
      { subject: 'person', predicate: 'carrying', object: 'bowl', score: 0.55, subjectIndex: 0, objectIndex: 1 },
    ];
    const sceneBoxes = [
      { x: 100, y: 200, width: 300, height: 400, class: 'person' },
      { x: 640, y: 480, width: 120, height: 60, class: 'bowl' },
      { x: 0, y: 500, width: 220, height: 400, class: 'scooter' },
    ];
    analyzeRelationsWithSceneMock.mockResolvedValue({ relations: computed, boxes: sceneBoxes, processingTimeMs: 400 });
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-5',
        file_path: '/app/data/detections/c.jpg',
        object_detections: [{ bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' }],
        relations: null,
      },
    ]);

    const result = (await service.getEventRelations('55555555-5555-4555-8555-555555555555')) as {
      source: string;
      relations: unknown[];
      boxes?: Array<{ class: string }>;
    };

    expect(result.source).toBe('computed');
    expect(result.relations).toEqual(computed);
    expect(analyzeRelationsWithSceneMock).toHaveBeenCalledWith('/app/data/detections/c.jpg', [
      { bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' },
    ]);
    expect(analyzeRelationsMock).not.toHaveBeenCalled();
    expect(detectObjectsMock).not.toHaveBeenCalled();
    expect(result.boxes).toHaveLength(3);
  });

  it('uses the opencv scene fallback when the world detector fails', async () => {
    analyzeRelationsWithSceneMock.mockRejectedValue(new Error('world model unavailable'));
    analyzeRelationsMock.mockResolvedValue({
      relations: [
        { subject: 'person', predicate: 'near', object: 'car', score: 0.6, subjectIndex: 0, objectIndex: 1 },
      ],
      processingTimeMs: 300,
    });
    detectObjectsMock.mockResolvedValue({
      success: true,
      detections: [{ class: 'car', confidence: 80, bbox: { x: 900, y: 300, width: 400, height: 300 } }],
    });
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-5b',
        file_path: '/app/data/detections/c2.jpg',
        object_detections: [{ bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' }],
        relations: null,
      },
    ]);

    const result = (await service.getEventRelations('55555556-5556-4556-8556-555555555556')) as {
      source: string;
      boxes?: Array<{ class: string }>;
    };

    expect(result.source).toBe('computed');
    expect(detectObjectsMock).toHaveBeenCalled();
    expect(analyzeRelationsMock).toHaveBeenCalledWith('/app/data/detections/c2.jpg', [
      { bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' },
      { bbox: { x: 900, y: 300, width: 400, height: 300 }, class: 'car' },
    ]);
    expect(result.boxes).toHaveLength(2);
  });

  it('deduplicates scene boxes that overlap tracked ones', async () => {
    analyzeRelationsMock.mockResolvedValue({ relations: [], processingTimeMs: 300 });
    detectObjectsMock.mockResolvedValue({
      success: true,
      detections: [
        { class: 'person', confidence: 90, bbox: { x: 105, y: 205, width: 290, height: 390 } },
        { class: 'car', confidence: 80, bbox: { x: 900, y: 300, width: 400, height: 300 } },
      ],
    });
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-6',
        file_path: '/app/data/detections/d.jpg',
        object_detections: [{ bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' }],
        relations: null,
      },
    ]);

    const result = (await service.getEventRelations('66666666-6666-4666-8666-666666666666')) as {
      boxes?: Array<{ class: string }>;
    };

    expect(result.boxes).toHaveLength(2);
    expect(result.boxes!.map((b) => b.class)).toEqual(['person', 'car']);
  });

  it('reports unavailable when scene detection also finds nothing usable', async () => {
    detectObjectsMock.mockRejectedValue(new Error('opencv down'));
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-7',
        file_path: '/app/data/detections/e.jpg',
        object_detections: [{ bbox: { x: 1, y: 1, width: -3, height: 5 }, class: 'bicycle' }],
        relations: null,
      },
    ]);

    const result = (await service.getEventRelations('77777777-7777-4777-8777-777777777777')) as {
      source: string;
      reason?: string;
    };

    expect(result.source).toBe('unavailable');
    expect(result.reason).toBe('fewer than two detectable objects in snapshot');
    expect(analyzeRelationsMock).not.toHaveBeenCalled();
  });

  it('drops scene classes outside the security allowlist', async () => {
    analyzeRelationsMock.mockResolvedValue({ relations: [], processingTimeMs: 300 });
    detectObjectsMock.mockResolvedValue({
      success: true,
      detections: [
        { class: 'boat', confidence: 90, bbox: { x: 1200, y: 300, width: 400, height: 500 } },
        { class: 'bicycle', confidence: 80, bbox: { x: 1800, y: 200, width: 300, height: 400 } },
      ],
    });
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-8',
        file_path: '/app/data/detections/f.jpg',
        object_detections: [{ bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' }],
        relations: null,
      },
    ]);

    const result = (await service.getEventRelations('88888888-8888-4888-8888-888888888888')) as {
      boxes?: Array<{ class: string }>;
    };

    expect(result.boxes!.map((b) => b.class)).toEqual(['person', 'bicycle']);
  });

  it('keeps one best relation per pair, capped and score-filtered', async () => {
    const triplets = [
      { subject: 'person', predicate: 'next to', object: 'scooter', score: 0.45, subjectIndex: 0, objectIndex: 2 },
      { subject: 'person', predicate: 'near', object: 'scooter', score: 0.72, subjectIndex: 0, objectIndex: 2 },
      { subject: 'scooter', predicate: 'next to', object: 'person', score: 0.4, subjectIndex: 2, objectIndex: 0 },
      { subject: 'person', predicate: 'holding', object: 'bowl', score: 0.2, subjectIndex: 0, objectIndex: 1 },
      { subject: 'person', predicate: 'carrying', object: 'bowl', score: 0.55, subjectIndex: 0, objectIndex: 1 },
      { subject: 'scooter', predicate: 'near', object: 'bowl', score: 0.42, subjectIndex: 2, objectIndex: 1 },
    ];
    const sceneBoxes = [
      { x: 100, y: 200, width: 300, height: 400, class: 'person' },
      { x: 640, y: 480, width: 120, height: 60, class: 'bowl' },
      { x: 0, y: 500, width: 220, height: 400, class: 'scooter' },
    ];
    analyzeRelationsWithSceneMock.mockResolvedValue({ relations: triplets, boxes: sceneBoxes, processingTimeMs: 300 });
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-9',
        file_path: '/app/data/detections/g.jpg',
        object_detections: [{ bbox: { x: 100, y: 200, width: 300, height: 400 }, class: 'person' }],
        relations: null,
      },
    ]);

    const result = (await service.getEventRelations('99999999-9999-4999-8999-999999999999')) as {
      relations: Array<{ predicate: string; score: number; subjectIndex: number; objectIndex: number }>;
    };

    expect(result.relations).toHaveLength(3);
    expect(result.relations.map((r) => r.predicate)).toEqual(['near', 'carrying', 'near']);
    expect(result.relations[0]).toMatchObject({ score: 0.72, subjectIndex: 0, objectIndex: 2 });
    const pairs = result.relations.map((r) =>
      [Math.min(r.subjectIndex, r.objectIndex), Math.max(r.subjectIndex, r.objectIndex)].join('-'),
    );
    expect(new Set(pairs).size).toBe(3);
  });
});
