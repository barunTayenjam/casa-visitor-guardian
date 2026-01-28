import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

jest.mock('../middleware/authenticate.js');

describe('Detection Routes', () => {
  let app: any;

  beforeEach(() => {
    app = require('./index.ts').default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/detection/config', () => {
    it('should return detection config', async () => {
      const response = await request(app)
        .get('/api/detection/config')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return default config when no custom config exists', async () => {
      const response = await request(app)
        .get('/api/detection/config')
        .set('Authorization', 'Bearer valid-token');

      expect(response.body.data.thresholds).toBeDefined();
      expect(response.body.data.thresholds.person).toBeDefined();
      expect(response.body.data.labelmap).toBeDefined();
    });
  });

  describe('PUT /api/detection/config', () => {
    it('should update detection config', async () => {
      const updateData = {
        thresholds: { person: { min_score: 0.4, threshold: 0.6 } },
        labelmap: { person: 'Person' }
      };

      const response = await request(app)
        .put('/api/detection/config')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
