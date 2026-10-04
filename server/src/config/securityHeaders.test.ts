import { describe, it, expect, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { securityHeaders } from './securityHeaders.js';

// SentryVision serves the UI over plain HTTP on the LAN (port 9753, no TLS
// terminator). `upgrade-insecure-requests` makes the browser rewrite every
// same-origin subresource to https://, which kills all JS/CSS loading and
// strands the app on its static "Loading your workspace…" prerender.
describe('securityHeaders content-security-policy', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  async function fetchCsp(env: string | undefined): Promise<string> {
    process.env.NODE_ENV = env;
    const app = express();
    app.use(securityHeaders());
    app.get('/', (_req, res) => res.send('ok'));
    const response = await request(app).get('/');
    return (response.headers['content-security-policy'] as string) ?? '';
  }

  it('production CSP must not contain upgrade-insecure-requests (HTTP-only deployment)', async () => {
    const csp = await fetchCsp('production');
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('development CSP must not contain upgrade-insecure-requests', async () => {
    const csp = await fetchCsp('development');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
