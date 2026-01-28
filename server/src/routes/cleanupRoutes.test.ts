import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.mock('../middleware/authenticate.js');

describe('Cleanup Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/cleanup/events', () => {
    it('should cleanup old events', async () => {
      const response = await request(app)
        .post('/api/cleanup/events')
        .set('Authorization', 'Bearer valid-token')
        .send({
          daysToRetain: 30,
          dryRun: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate days parameter', async () => {
      const response = await request(app)
        .post('/api/cleanup/events')
        .set('Authorization', 'Bearer valid-token')
        .send({
          daysToRetain: -10
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should support dry run', async () => {
      const response = await request(app)
        .post('/api/cleanup/events')
        .set('Authorization', 'Bearer valid-token')
        .send({
          daysToRetain: 30,
          dryRun: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/cleanup/images', () => {
    it('should cleanup old images', async () => {
      const response = await request(app)
        .post('/api/cleanup/images')
        .set('Authorization', 'Bearer valid-token')
        .send({
          maxStorageGB: 100,
          minFreeSpaceGB: 20,
          dryRun: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
