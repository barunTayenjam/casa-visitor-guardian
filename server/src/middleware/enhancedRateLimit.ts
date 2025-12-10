import { Request, Response, NextFunction } from 'express';
import cacheService from '../services/cacheService.js';

interface EnhancedRateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class EnhancedRateLimit {
  private options: Required<EnhancedRateLimitOptions>;

  constructor(options: EnhancedRateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      max: options.max,
      message: options.message || 'Too many requests',
      keyGenerator: options.keyGenerator || ((req) => this.getDefaultKey(req)),
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
    };
  }

  private getDefaultKey(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.connection.remoteAddress || 'unknown';
    return `rate_limit:${ip}:${req.path}`;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.options.keyGenerator(req);
        
        // Check rate limit using cache service
        const result = await cacheService.checkRateLimit(key, this.options.max, this.options.windowMs);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.options.max.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
        });

        if (!result.allowed) {
          // Rate limit exceeded
          res.status(429).json({
            error: this.options.message,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          });
          return;
        }

        // Track request for analytics
        await cacheService.incrementCounter('requests_total');
        await cacheService.incrementCounter(`requests_${req.method}_${req.path}`);

        // Store request in cache for analytics (recent requests)
        await cacheService.set(
          `recent_request:${Date.now()}:${Math.random()}`,
          {
            ip: req.ip,
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          },
          300 // 5 minutes
        );

        next();
      } catch (error) {
        console.error('Rate limit middleware error:', error);
        // Allow request to proceed if rate limiting fails
        next();
      }
    };
  }
}

// Rate limit presets
export const createApiRateLimit = () => {
  const rateLimit = new EnhancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes
    message: 'Too many API requests, please try again later'
  });
  return rateLimit.middleware();
};

export const createAuthRateLimit = () => {
  const rateLimit = new EnhancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 auth attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    keyGenerator: (req) => `auth:${req.ip || 'unknown'}`
  });
  return rateLimit.middleware();
};

export const createStreamRateLimit = () => {
  const rateLimit = new EnhancedRateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 stream requests per minute
    message: 'Too many stream requests, please reduce frequency',
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return `stream:${ip}`;
    }
  });
  return rateLimit.middleware();
};

export const createDetectionRateLimit = () => {
  const rateLimit = new EnhancedRateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 detection requests per minute
    message: 'Too many detection requests, please try again later'
  });
  return rateLimit.middleware();
};

// Analytics and monitoring
export const getRateLimitStats = async () => {
  try {
    const totalRequests = await cacheService.getCounter('requests_total');
    const recentRequests = await cacheService.get('recent_request_count') || 0;
    
    return {
      totalRequests,
      recentRequests,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  } catch (error) {
    console.error('Error getting rate limit stats:', error);
    return null;
  }
};