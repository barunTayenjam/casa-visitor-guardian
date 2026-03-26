import { Request, Response, NextFunction } from 'express';
import { LessThan } from 'typeorm';
import { AppDataSource } from '../database.js';
import { RateLimitCounter } from '../models/RateLimitCounter.js';
import { SecurityEvent, SecurityEventType } from '../models/SecurityEvent.js';
import { getRateLimitTierForPath, RATE_LIMITS, type RateLimitTierType } from '../config/rateLimits.js';
import { logger } from '../utils/logger.js';
import { JWTPayload } from '../auth/index.js';

interface RateLimitRequest extends Request {
  user?: JWTPayload;
}

export function rateLimitMiddleware(tier?: RateLimitTierType) {
  return async (req: RateLimitRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limitTier = tier || getRateLimitTierForPath(req.path);
      const limitConfig = RATE_LIMITS[limitTier];
      const userId = (req.user?.userId) || null;
      const endpoint = req.route?.path || req.path;

      if (!AppDataSource.isInitialized) {
        logger.warn('Database not initialized, skipping rate limit check', 'RateLimit');
        next();
        return;
      }

      const rateLimitRepo = AppDataSource.getRepository(RateLimitCounter);
      const now = new Date();
      const windowStart = new Date(now.getTime() - limitConfig.window);

      const existingCounter = await rateLimitRepo.findOne({
        where: {
          userId,
          endpoint,
          windowStart: LessThan(now)
        },
        order: { windowStart: 'DESC' }
      });

      if (existingCounter) {
        const windowEndTime = new Date(existingCounter.windowStart.getTime() + limitConfig.window);

        if (now < windowEndTime) {
          existingCounter.count += 1;
          await rateLimitRepo.save(existingCounter);

          if (existingCounter.count > limitConfig.requests) {
            const retryAfter = Math.ceil((windowEndTime.getTime() - now.getTime()) / 1000);

            logger.warn(`Rate limit exceeded for user ${userId} on ${endpoint}`, 'RateLimit', {
              userId,
              endpoint,
              count: existingCounter.count,
              limit: limitConfig.requests
            });

            const securityEventRepo = AppDataSource.getRepository(SecurityEvent);
            const securityEvent = securityEventRepo.create({
              eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
              userId,
              ipAddress: req.ip,
              details: {
                endpoint,
                count: existingCounter.count,
                limit: limitConfig.requests,
                tier: limitTier
              }
            });
            await securityEventRepo.save(securityEvent);

            res.setHeader('Retry-After', String(retryAfter));
            res.status(429).json({
              error: 'Too many requests',
              message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
              retryAfter
            });
            return;
          }
        } else {
          existingCounter.count = 1;
          existingCounter.windowStart = now;
          await rateLimitRepo.save(existingCounter);
        }
      } else {
        const newCounter = rateLimitRepo.create({
          userId,
          endpoint,
          count: 1,
          windowStart: now
        });
        await rateLimitRepo.save(newCounter);
      }

      const currentCount = existingCounter?.count || 1;
      res.setHeader('X-RateLimit-Limit', String(limitConfig.requests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limitConfig.requests - currentCount)));

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', 'RateLimit', error);
      next();
    }
  };
}

export function skipRateLimit(req: Request): boolean {
  const skipPaths = ['/api/health', '/api/status', '/api/healthcheck'];
  return skipPaths.some(path => req.path.startsWith(path));
}
