import { describe, it, expect, jest, beforeAll } from '@jest/globals';

jest.unstable_mockModule('../../database.js', () => ({
  AppDataSource: {
    query: jest.fn(),
    getRepository: () => ({}),
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));


describe('eventSearchService.getCameraMotionEvents', () => {
  let AppDataSource;
  let service;

  beforeAll(async () => {
    const dbMod = await import('../../database.js');
    AppDataSource = dbMod.AppDataSource;
    const mod = await import('./eventSearchService.js');
    service = mod.EventSearchService ? new mod.EventSearchService() : mod.default;
  });

  it('maps SQL aliases cameraId/imagePath into the returned event', async () => {
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-abc',
        cameraId: 'cam1',
        timestamp: '2026-01-02T10:00:00.000Z',
        imagePath: '/data/detections/cam1_motion.jpg',
        metadata: JSON.stringify({ confidence: 0.9 }),
      },
    ]);

    const events = await service.getCameraMotionEvents('cam1', 20);
    expect(events).toHaveLength(1);
    expect(events[0].cameraId).toBe('cam1');
    expect(events[0].imagePath).toBe('/events/cam1_motion.jpg');
    expect(events[0].imageUrl).toBe('/events/cam1_motion.jpg');
  });

  it('falls back to "unknown" only when the row truly has no camera', async () => {
    AppDataSource.query.mockResolvedValue([
      {
        id: 'evt-def',
        cameraId: null,
        timestamp: '2026-01-02T10:00:00.000Z',
        imagePath: null,
        metadata: null,
      },
    ]);

    const events = await service.getCameraMotionEvents('cam1', 20);
    expect(events).toHaveLength(1);
    expect(events[0].cameraId).toBe('unknown');
    expect(events[0].cameraName).toBe('Camera unknown');
  });
});
