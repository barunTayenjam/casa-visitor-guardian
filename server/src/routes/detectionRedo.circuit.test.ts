import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';

process.env.JWT_ACCESS_SECRET = 'redo-circuit-test-secret-0123456789abcdef';

jest.unstable_mockModule('../database.js', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn(async () => [{ file_uuid: 'f-1' }]) },
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

// OpenCV permanently down — every call fails.
jest.unstable_mockModule('axios', () => ({
  default: { post: jest.fn(async () => Promise.reject(new Error('opencv down'))) },
}));

describe('detection redo circuit breaker', () => {
  let app: express.Express;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let axios: any;

  beforeAll(async () => {
    ({ default: axios } = await import('axios'));
    const router = (await import('./detectionRedoRoutes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/detection-redo', router);
  });

  it('opens after consecutive failures and short-circuits further calls', async () => {
    const filepath = path.posix.join(
      'data',
      'detections',
      '2026-01',
      'events',
      'motion',
      'motion_cam1_z.jpg',
    );

    // Three consecutive failures reach the (mocked) service each time.
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/detection-redo/rerun-detection').send({ filepath });
      expect(res.status).toBe(500);
    }
    expect(axios.post).toHaveBeenCalledTimes(3);

    // Fourth call is rejected by the open circuit — no HTTP attempt.
    const res = await request(app).post('/api/detection-redo/rerun-detection').send({ filepath });
    expect(res.status).toBe(500);
    expect(axios.post).toHaveBeenCalledTimes(3); // unchanged — short-circuited
    expect(JSON.stringify(res.body)).toMatch(/circuit breaker/i);
  });
});
