import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Visitor Routes', () => {
  let app: any;

  beforeEach(() => {
    app = require('./index.ts').default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/visitors', () => {
    it('should return visitors list', async () => {
      const response = await global.request(app)
        .get('/api/visitors')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter visitors by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      
      const response = await global.request(app)
        .get(`/api/visitors?after=${startDate}&before=${endDate}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it('should filter visitors by camera', async () => {
      const response = await global.request(app)
        .get('/api/visitors?camera=front_door')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/visitors/stats', () => {
    it('should return visitor statistics', async () => {
      const response = await global.request(app)
        .get('/api/visitors/stats')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalVisitors).toBeDefined();
      expect(response.body.data.uniqueVisitors).toBeDefined();
    });
  });

  describe('GET /api/visitors/:id', () => {
    it('should return visitor by id', async () => {
      const response = await global.request(app)
        .get('/api/visitors/visitor-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('visitor-123');
      expect(response.body.data).toBeDefined();
    });

    it('should return 404 for non-existent visitor', async () => {
      const response = await global.request(app)
        .get('/api/visitors/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });
});
