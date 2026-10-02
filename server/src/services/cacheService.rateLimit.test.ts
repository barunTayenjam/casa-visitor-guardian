import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

process.env.REDIS_DISABLED = 'true';
process.env.JWT_ACCESS_SECRET = 'cache-rl-test-secret-0123456789abcdef';

describe('CacheService.checkRateLimit fixed window', () => {
  let CacheService: typeof import('./cacheService.js').CacheService;

  beforeAll(async () => {
    ({ CacheService } = await import('./cacheService.js'));
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a burst mid-window does NOT extend the window (fixed, not sliding)', async () => {
    const cs = new CacheService();
    const windowMs = 10_000;
    const key = 'rate_limit:test-fixed-window';

    await cs.checkRateLimit(key, 3, windowMs);
    jest.advanceTimersByTime(9_000); // 9s into the window
    await cs.checkRateLimit(key, 3, windowMs);

    // 11s after the first request — outside the original window.
    // Fixed window: the counter reset, so remaining is back to full budget.
    // Sliding (buggy): the t=9s request reset expiry, so count is still 3.
    jest.advanceTimersByTime(2_000);
    const result = await cs.checkRateLimit(key, 3, windowMs);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('still counts requests and rejects inside the window', async () => {
    const cs = new CacheService();
    const key = 'rate_limit:test-inside-window';
    const windowMs = 10_000;

    const r1 = await cs.checkRateLimit(key, 2, windowMs);
    const r2 = await cs.checkRateLimit(key, 2, windowMs);
    const r3 = await cs.checkRateLimit(key, 2, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
  });
});
