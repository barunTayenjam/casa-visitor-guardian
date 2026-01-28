import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { z } from 'zod';

jest.mock('../middleware/authenticate.js');

describe('Timeline Routes', () => {
  let app: any;

  beforeEach(() => {
    app = require('./index.ts').default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/timeline', () => {
    it('should return timeline events', async () => {
      const response = await request(app)
        .get('/api/timeline')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });

    it('should apply camera filter', async () => {
      const response = await request(app)
        .get('/api/timeline?camera=front_door')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should apply date range filter', async () => {
      const response = await request(app)
        .get('/api/timeline?after=2024-01-01&before=2024-01-31')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should limit results', async () => {
      const response = await request(app)
        .get('/api/timeline?limit=50')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/timeline?limit=invalid')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });
});
