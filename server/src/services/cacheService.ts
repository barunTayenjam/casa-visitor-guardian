import { createClient, RedisClientType } from 'redis';

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  ttl: number;
}

class CacheService {
  private client: RedisClientType | null = null;
  private config: CacheConfig;
  private isConnected: boolean = false;
  private connectionAttempted: boolean = false;
  private redisAvailable: boolean = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      ttl: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour default
      ...config
    };
  }

  async connect(): Promise<void> {
    // Skip Redis connection if explicitly disabled or already attempted
    if (this.connectionAttempted) {
      return;
    }
    
    this.connectionAttempted = true;
    
    // Check if Redis is disabled via environment variable
    if (process.env.REDIS_DISABLED === 'true') {
      console.log('Redis explicitly disabled, using memory cache only');
      this.isConnected = false;
      this.client = null;
      return;
    }
    
    try {
      this.client = createClient({
        url: this.config.password 
          ? `redis://:${this.config.password}@${this.config.host}:${this.config.port}`
          : `redis://${this.config.host}:${this.config.port}`,
        socket: {
          connectTimeout: 5000
        }
      });

      this.client.on('error', (err) => {
        // Suppress repeated error messages - only log once
        if (this.isConnected) {
          console.warn('Redis connection lost, switching to memory cache');
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
        this.redisAvailable = true;
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.log('Redis not available, using memory cache for this session');
      console.log('Tip: To enable Redis caching, start Redis server or set REDIS_HOST/PORT');
      console.log('To disable Redis completely, set REDIS_DISABLED=true');
      this.isConnected = false;
      this.client = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }

  private isRedisAvailable(): boolean {
    return !!(this.client && this.isConnected && this.redisAvailable);
  }

  async get(key: string): Promise<string | null> {
    if (!this.isRedisAvailable()) {
      return this.getMemoryCacheString(key);
    }

    try {
      if (!this.client) throw new Error('Client not initialized');
      const value = await this.client.get(key);
      return value || null;
    } catch (error) {
      console.warn('Redis get error, falling back to memory:', error);
      return this.getMemoryCacheString(key);
    }
  }

  async getJSON(key: string): Promise<any> {
    if (!this.isRedisAvailable()) {
      return this.getMemoryCache(key);
    }

    try {
      if (!this.client) throw new Error('Client not initialized');
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Redis get error, falling back to memory:', error);
      return this.getMemoryCache(key);
    }
  }

  private getMemoryCacheString(key: string): string | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
  }

  async set(key: string, value: any, customTtl?: number): Promise<void> {
    const ttl = customTtl || this.config.ttl;

    if (!this.isRedisAvailable()) {
      this.setMemoryCache(key, value, ttl);
      return;
    }

    try {
      if (!this.client) throw new Error('Client not initialized');
      await this.client.setEx(key, ttl, JSON.stringify(value));
      // Also set memory cache as backup
      this.setMemoryCache(key, value, ttl);
    } catch (error) {
      console.warn('Redis set error, using memory cache only:', error);
      this.setMemoryCache(key, value, ttl);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isRedisAvailable()) {
      this.delMemoryCache(key);
      return;
    }

    try {
      if (!this.client) throw new Error('Client not initialized');
      await this.client.del(key);
      this.delMemoryCache(key);
    } catch (error) {
      console.warn('Redis delete error:', error);
      this.delMemoryCache(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isRedisAvailable()) {
      return this.memoryCache.has(key);
    }

    try {
      if (!this.client) throw new Error('Client not initialized');
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('Redis exists error:', error);
      return this.memoryCache.has(key);
    }
  }

  async incr(key: string, ttl?: number): Promise<number> {
    if (!this.isRedisAvailable()) {
      return this.incrMemoryCache(key, ttl);
    }

    try {
      if (!this.client) throw new Error('Client not initialized');
      const result = await this.client.incr(key);
      if (ttl) {
        await this.client.expire(key, ttl);
      }
      return result;
    } catch (error) {
      console.warn('Redis incr error, using memory:', error);
      return this.incrMemoryCache(key, ttl);
    }
  }

  // Memory cache fallback
  private memoryCache = new Map<string, { value: any; expiry: number }>();

  private getMemoryCache(key: string): any {
    const item = this.memoryCache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.value;
  }

  private setMemoryCache(key: string, value: any, ttl: number): void {
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000)
    });
    
    // Cleanup expired entries periodically
    if (this.memoryCache.size > 1000) {
      this.cleanupMemoryCache();
    }
  }

  private delMemoryCache(key: string): void {
    this.memoryCache.delete(key);
  }

  private incrMemoryCache(key: string, ttl?: number): number {
    let value = 0;
    const item = this.memoryCache.get(key);
    
    if (item && Date.now() <= item.expiry) {
      value = typeof item.value === 'number' ? item.value : 0;
    }
    
    value++;
    this.setMemoryCache(key, value, ttl || this.config.ttl);
    return value;
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Rate limiting helpers
  async checkRateLimit(key: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const current = await this.incr(key, Math.ceil(windowMs / 1000));
    const remaining = Math.max(0, limit - current);
    const allowed = current <= limit;
    const resetTime = Date.now() + windowMs;

    return {
      allowed,
      remaining,
      resetTime
    };
  }

  // Analytics helpers
  async incrementCounter(key: string, amount = 1): Promise<void> {
    await this.incr(key, 86400); // 24 hour TTL
  }

  async getCounter(key: string): Promise<number> {
    const value = await this.get(key);
    return typeof value === 'number' ? value : 0;
  }
}

// Singleton instance
export const cacheService = new CacheService();
export default cacheService;