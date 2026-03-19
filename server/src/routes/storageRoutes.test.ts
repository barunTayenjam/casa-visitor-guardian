import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import storageRoutes from '../storageRoutes.js';
import { storageStatsService } from '../../services/storageStatsService.js';
import { retentionPolicyService } from '../../services/retentionPolicyService.js';
import { automatedCleanupService } from '../../services/automatedCleanupService.js';
import { AppDataSource } from '../../database.js';

describe('Storage Management API', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/storage', storageRoutes);

    await storageStatsService.initialize();
    await retentionPolicyService.initialize();
    await automatedCleanupService.initialize();
  });

  afterAll(async () => {
    await automatedCleanupService.shutdown();
  });

  describe('GET /api/storage/stats/overview', () => {
    it('should return storage overview', async () => {
      const response = await request(app)
        .get('/api/storage/stats/overview')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('storage');
      expect(response.body.data).toHaveProperty('projection');
      expect(response.body.data).toHaveProperty('cleanup');
      expect(response.body.data.storage).toHaveProperty('totalBytes');
      expect(response.body.data.storage).toHaveProperty('percentageUsed');
    });
  });

  describe('GET /api/storage/stats/detailed', () => {
    it('should return detailed storage stats', async () => {
      const response = await request(app)
        .get('/api/storage/stats/detailed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by camera', async () => {
      const response = await request(app)
        .get('/api/storage/stats/detailed?camera=cam1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((stat: any) => stat.camera === 'cam1')).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/storage/stats/detailed?category=alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((stat: any) => stat.category === 'alerts')).toBe(true);
    });
  });

  describe('GET /api/storage/stats/projection', () => {
    it('should return storage projection', async () => {
      const response = await request(app)
        .get('/api/storage/stats/projection?days=30')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('projectedGB');
      expect(response.body.data).toHaveProperty('willExceedCapacity');
      expect(response.body.data).toHaveProperty('daysUntilFull');
    });
  });

  describe('POST /api/storage/stats/recalculate', () => {
    it('should trigger stats recalculation', async () => {
      const response = await request(app)
        .post('/api/storage/stats/recalculate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('recalculation initiated');
    });
  });

  describe('GET /api/storage/retention/policies', () => {
    it('should return all retention policies', async () => {
      const response = await request(app)
        .get('/api/storage/retention/policies')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/storage/retention/policies/:camera', () => {
    it('should return global retention policy', async () => {
      const response = await request(app)
        .get('/api/storage/retention/policies/global')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alertsDays');
      expect(response.body.data).toHaveProperty('detectionsDays');
      expect(response.body.data).toHaveProperty('previewsDays');
      expect(response.body.data).toHaveProperty('snapshotsDays');
      expect(response.body.data).toHaveProperty('eventsDays');
      expect(response.body.data).toHaveProperty('retainIndefinitely');
    });
  });

  describe('PUT /api/storage/retention/policies/:camera', () => {
    it('should update retention policy', async () => {
      const updateData = {
        alertsDays: 45,
        detectionsDays: 14,
      };

      const response = await request(app)
        .put('/api/storage/retention/policies/global')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alertsDays).toBe(45);
      expect(response.body.data.detectionsDays).toBe(14);
    });

    it('should reject invalid retention days', async () => {
      const invalidData = {
        alertsDays: 500,
      };

      await request(app)
        .put('/api/storage/retention/policies/global')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('DELETE /api/storage/retention/policies/:camera', () => {
    it('should not allow deleting global policy', async () => {
      await request(app)
        .delete('/api/storage/retention/policies/global')
        .expect(400);
    });
  });

  describe('GET /api/storage/retention/summary', () => {
    it('should return retention summary', async () => {
      const response = await request(app)
        .get('/api/storage/retention/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('policy');
      expect(response.body.data).toHaveProperty('expiredFiles');
      expect(response.body.data).toHaveProperty('totalExpiredFiles');
    });
  });

  describe('GET /api/storage/cleanup/status', () => {
    it('should return cleanup status', async () => {
      const response = await request(app)
        .get('/api/storage/cleanup/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('inProgress');
      expect(response.body.data).toHaveProperty('history');
      expect(response.body.data).toHaveProperty('stats');
    });
  });

  describe('GET /api/storage/health', () => {
    it('should return storage health status', async () => {
      const response = await request(app)
        .get('/api/storage/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data).toHaveProperty('storage');
      expect(response.body.data).toHaveProperty('cleanup');
      expect(response.body.data.storage.status).toMatch(/healthy|warning|critical/);
    });
  });

  describe('POST /api/storage/cleanup/run', () => {
    it('should run manual cleanup', async () => {
      const response = await request(app)
        .post('/api/storage/cleanup/run')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deletedFiles');
      expect(response.body.data).toHaveProperty('freedBytes');
    }, 30000);
  });

  describe('POST /api/storage/retention/apply', () => {
    it('should apply retention policy', async () => {
      const response = await request(app)
        .post('/api/storage/retention/apply')
        .send({ category: 'alerts' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deletedFiles');
    });
  });
});
