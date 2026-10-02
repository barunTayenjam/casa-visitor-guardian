import { describe, it, expect, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.JWT_ACCESS_SECRET = 'rl-keying-test-secret-0123456789abcdef';

describe('EnhancedRateLimit default keying', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let EnhancedRateLimit: any;
  let app: express.Express;

  beforeAll(async () => {
    ({ EnhancedRateLimit } = await import('./enhancedRateLimit.js'));
  });

  it('shares one bucket per real client even when X-Forwarded-For is spoofed (trust proxy off)', async () => {
    const rl = new EnhancedRateLimit({
      windowMs: 60_000,
      max: 2,
      message: 'slow down',
    });
    app = express();
    app.use(rl.middleware());
    app.get('/x', (_req, res) => res.status(200).json({ ok: true }));

    const r1 = await request(app).get('/x').set('X-Forwarded-For', '1.1.1.1');
    expect(r1.status).toBe(200);
    const r2 = await request(app).get('/x').set('X-Forwarded-For', '2.2.2.2');
    expect(r2.status).toBe(200);
    // Same client, no spoofed header — must hit the same bucket as r1/r2.
    const r3 = await request(app).get('/x');
    expect(r3.status).toBe(429);
  });
});
