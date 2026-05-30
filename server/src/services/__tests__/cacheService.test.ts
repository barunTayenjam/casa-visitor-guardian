import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    apiError: jest.fn(),
    socketConnect: jest.fn(),
    socketDisconnect: jest.fn(),
    socketError: jest.fn(),
    streamRequest: jest.fn(),
    streamStop: jest.fn(),
    serverStart: jest.fn(),
    corsBlock: jest.fn(),
    motionDetected: jest.fn(),
    motionError: jest.fn(),
    performance: jest.fn(),
    memoryUsage: jest.fn(),
  },
}));

describe('CacheService (in-memory fallback)', () => {
  let CacheServiceClass: any;
  let cacheService: any;

  beforeEach(async () => {
    jest.resetModules();
    process.env.REDIS_DISABLED = 'true';

    jest.mock('../../utils/logger.js', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    }));

    const mod = await import('../cacheService.js');
    CacheServiceClass = mod.CacheService;
    cacheService = new CacheServiceClass();
    await cacheService.connect();
  });

  afterEach(() => {
    delete process.env.REDIS_DISABLED;
  });

  it('should store and retrieve a value', async () => {
    await cacheService.set('key1', { name: 'test' });
    const result = await cacheService.getJSON('key1');
    expect(result).toEqual({ name: 'test' });
  });

  it('should return null for non-existent key', async () => {
    const result = await cacheService.getJSON('missing');
    expect(result).toBeNull();
  });

  it('should return null after TTL expiry', async () => {
    await cacheService.set('expiring', 'value', 1);

    await new Promise((r) => setTimeout(r, 1100));

    const result = await cacheService.getJSON('expiring');
    expect(result).toBeNull();
  });

  it('should delete a key', async () => {
    await cacheService.set('delKey', 'data');
    await cacheService.del('delKey');
    const result = await cacheService.getJSON('delKey');
    expect(result).toBeNull();
  });

  it('should handle connect gracefully when Redis is disabled', async () => {
    await expect(cacheService.connect()).resolves.toBeUndefined();
  });

  it('should check key existence', async () => {
    await cacheService.set('existsKey', 'val');
    const exists = await cacheService.exists('existsKey');
    expect(exists).toBe(true);

    const missing = await cacheService.exists('noKey');
    expect(missing).toBe(false);
  });

  it('should increment counters', async () => {
    const val1 = await cacheService.incr('counter');
    expect(val1).toBe(1);

    const val2 = await cacheService.incr('counter');
    expect(val2).toBe(2);
  });

  it('should get string values via get()', async () => {
    await cacheService.set('strKey', 'hello');
    const result = await cacheService.get('strKey');
    expect(result).toBe('hello');
  });

  it('should disconnect cleanly', async () => {
    await expect(cacheService.disconnect()).resolves.toBeUndefined();
  });
});
