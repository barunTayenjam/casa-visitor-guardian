import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';

process.env.JWT_ACCESS_SECRET = 'redo-rerun-test-secret-0123456789abcdef';

jest.unstable_mockModule('../database.js', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn(async () => []) },
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireUser: (req: any, _res: any, next: any) => {
    req.user = { userId: 'u-1', username: 'tester', role: 'admin' };
    next();
  },
}));

jest.unstable_mockModule('fs/promises', () => ({
  access: jest.fn(async () => undefined),
  readFile: jest.fn(async () => Buffer.from('jpeg')),
}));

jest.unstable_mockModule('axios', () => ({
  default: { post: jest.fn(async () => ({ data: { detections: [] } })) },
}));

describe('POST /api/detection-redo/rerun-detection honest results', () => {
  let app: express.Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AppDataSource: any;

  const inDetections = (rel: string) => path.posix.join('data', 'detections', rel);

  beforeAll(async () => {
    ({ AppDataSource } = await import('../database.js'));
    const router = (await import('./detectionRedoRoutes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/detection-redo', router);
  });

  beforeEach(() => {
    AppDataSource.query.mockClear();
  });

  it('filepath-only request reports failure when no DB row matched (0 rows updated)', async () => {
    AppDataSource.query.mockResolvedValue([]); // UPDATE RETURNING → 0 rows
    const res = await request(app)
      .post('/api/detection-redo/rerun-detection')
      .send({ filepath: inDetections(path.join('2026-01', 'events', 'motion', 'motion_cam1_x.jpg')) });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('filepath-only request updates the basename-derived record and reports success', async () => {
    AppDataSource.query.mockResolvedValue([{ file_uuid: 'f-1' }]);
    const res = await request(app)
      .post('/api/detection-redo/rerun-detection')
      .send({ filepath: inDetections(path.join('2026-01', 'events', 'motion', 'motion_cam2_y.jpg')) });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('motion_cam2_y.jpg');
    // UPDATE must bind the derived filename, not undefined
    const updateCall = AppDataSource.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('UPDATE detection_files'),
    );
    expect(updateCall[1][6]).toBe('motion_cam2_y.jpg');
  });

  it('rejects filepaths outside data/detections', async () => {
    AppDataSource.query.mockResolvedValue([{ file_uuid: 'f-1' }]);
    const res = await request(app)
      .post('/api/detection-redo/rerun-detection')
      .send({ filepath: path.join('secrets', 'x.jpg') });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
