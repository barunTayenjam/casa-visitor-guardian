import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.JWT_ACCESS_SECRET = 'settings-save-test-secret-0123456789ab';

// The controller merges general/storage/notifications from req.body — the
// route's zod schema must not strip them, or every save is a silent no-op.
jest.unstable_mockModule('../database.js', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn(async () => []) },
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireUser: (req: any, _res: any, next: any) => {
    req.user = { userId: 'u-1', username: 'tester', role: 'admin' };
    next();
  },
}));

describe('PUT /api/settings payload survives validation', () => {
  let app: express.Express;

  beforeAll(async () => {
    const settingsRoutes = (await import('./settings.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRoutes);
  });

  // Exact payload shape frontend Settings.tsx handleSave sends.
  const frontendPayload = {
    general: {
      systemName: 'My SentryVision',
      timezone: 'Asia/Kolkata',
      language: 'en',
      theme: 'dark',
      autoBackup: true,
      backupFrequency: 'daily',
    },
    storage: {
      retentionDays: 30,
      maxStorageGB: 50,
      autoCleanup: true,
      compressionEnabled: true,
      compressionQuality: 80,
    },
    notifications: {
      emailEnabled: true,
      emailAddress: 'owner@example.com',
      pushEnabled: true,
      pushSoundEnabled: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    },
  };

  it('persists the payload groups (schema must not strip them)', async () => {
    const res = await request(app).put('/api/settings').send(frontendPayload);
    expect(res.status).toBe(200);
    expect(res.body.settings.general.systemName).toBe('My SentryVision');
    expect(res.body.settings.storage.retentionDays).toBe(30);
    expect(res.body.settings.notifications.emailEnabled).toBe(true);
  });

  it('rejects invalid storage values at the trust boundary', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ storage: { retentionDays: 'not-a-number' } });
    expect(res.status).toBe(400);
  });
});
