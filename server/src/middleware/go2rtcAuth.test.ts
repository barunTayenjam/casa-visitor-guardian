import { describe, it, expect, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.JWT_ACCESS_SECRET = 'go2rtc-auth-test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

describe('go2rtc proxy auth middleware', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let go2rtcAuth: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authService: any;
  let app: express.Express;

  const user = {
    id: 'user-1',
    username: 'tester',
    email: 'tester@example.com',
    password: 'irrelevant',
    role: 'user' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    ({ go2rtcAuth } = await import('./go2rtcAuth.js'));
    ({ authService } = await import('../auth/index.js'));
    app = express();
    app.use('/go2rtc', go2rtcAuth);
    app.use('/go2rtc', (_req, res) => res.status(200).json({ ok: true }));
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/go2rtc/api/streams');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('accepts a valid Authorization: Bearer token', async () => {
    const token = authService.generateToken(user);
    const res = await request(app)
      .get('/go2rtc/api/streams')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('accepts a valid ?token= query parameter (browser WebSocket/video cannot set headers)', async () => {
    const token = authService.generateToken(user);
    const res = await request(app).get(`/go2rtc/api/ws?src=cam1&token=${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app)
      .get('/go2rtc/api/streams')
      .set('Authorization', 'Bearer nonsense');
    expect(res.status).toBe(401);
  });

  describe('extractMediaToken (raw upgrade requests)', () => {
    let extractMediaToken: (req: { headers: Record<string, string>; url?: string }) => string | null;

    beforeAll(async () => {
      ({ extractMediaToken } = await import('./go2rtcAuth.js'));
    });

    it('reads a Bearer token from headers', () => {
      expect(
        extractMediaToken({ headers: { authorization: `Bearer abc` } }),
      ).toBe('abc');
    });

    it('reads the token query parameter from a raw upgrade URL', () => {
      expect(
        extractMediaToken({ headers: {}, url: '/api/ws?src=cam1&token=abc' }),
      ).toBe('abc');
    });

    it('returns null when neither is present', () => {
      expect(extractMediaToken({ headers: {}, url: '/api/ws?src=cam1' })).toBeNull();
    });
  });
});
