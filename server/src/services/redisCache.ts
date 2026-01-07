import Redis from 'ioredis';

export class RedisCache {
  private client: Redis;
  private readonly DEFAULT_TTL = 300;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 0,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('Redis: Too many retries, giving up');
          return null;
        }
        return Math.min(times * 100, 3000);
      }
    });

    this.client.on('connect', () => {
      console.log('Redis: Connected successfully');
    });

    this.client.on('error', (error) => {
      console.error('Redis: Connection error:', error);
    });

    this.client.on('reconnecting', () => {
      console.log('Redis: Reconnecting...');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      console.error('RedisCache: Get error for key', key, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('RedisCache: Set error for key', key, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('RedisCache: Delete error for key', key, error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('RedisCache: Keys error for pattern', pattern, error);
      return [];
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('RedisCache: Flush pattern error', error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('RedisCache: Exists error for key', key, error);
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      console.error('RedisCache: Expire error for key', key, error);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  isConnected(): boolean {
    return this.client.status === 'ready';
  }
}

let redisCacheInstance: RedisCache | null = null;

export function getRedisCache(): RedisCache {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCache();
  }
  return redisCacheInstance;
}

export const redisCache = getRedisCache();
