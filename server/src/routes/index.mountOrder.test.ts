import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Global API rate limiter mount order', () => {
  const source = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');

  it('mounts createApiRateLimit BEFORE any /api route (otherwise it is dead code)', () => {
    const limiterIndex = source.indexOf('app.use(createApiRateLimit())');
    expect(limiterIndex).toBeGreaterThan(-1);

    const firstApiRouteIndex = source.indexOf("app.get('/api/streaming/metrics'");
    expect(firstApiRouteIndex).toBeGreaterThan(-1);
    expect(limiterIndex).toBeLessThan(firstApiRouteIndex);
  });
});
