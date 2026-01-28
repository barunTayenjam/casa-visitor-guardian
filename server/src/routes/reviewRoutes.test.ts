import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.mock('../middleware/authenticate.js');

describe('Review Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/review', () => {
    it('should return review segments', async () => {
      const response = await request(app)
        .get('/api/review')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should apply limit parameter', async () => {
      const response = await request(app)
        .get('/api/review?limit=10')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/review/:id', () => {
    it('should return specific segment', async () => {
      const response = await request(app)
        .get('/api/review/seg-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('seg-123');
    });

    it('should return 404 for non-existent segment', async () => {
      const response = await request(app)
        .get('/api/review/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
