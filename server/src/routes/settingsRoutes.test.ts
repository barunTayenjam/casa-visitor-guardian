import { describe, it, expect, beforeEach } from '@jest/globals';

describe('System Settings Routes', () => {
  let app: any;

  beforeEach(() => {
    app = require('./index.ts').default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/settings', () => {
    it('should return system settings', async () => {
      const response = await global.request(app)
        .get('/api/settings')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.systemName).toBeDefined();
      expect(response.body.data.timezone).toBeDefined();
    });
  });

  describe('PUT /api/settings', () => {
    it('should update system settings', async () => {
      const updateData = {
        systemName: 'My Security System',
        timezone: 'America/New_York',
        language: 'en',
      };

      const response = await global.request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.systemName).toBe(updateData.systemName);
      expect(response.body.data.timezone).toBe(updateData.timezone);
    });

    it('should validate settings schema', async () => {
      const response = await global.request(app)
        .put('/api/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({
          systemName: 'Test',
          timezone: 'Invalid/Timezone',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
