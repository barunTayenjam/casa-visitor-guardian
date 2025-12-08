import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import expressRateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';

// Memory store for rate limiting (in production, use Redis)
const memoryStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs = config.security.rateLimitWindow,
    max = config.security.rateLimitMax,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req: Request) => {
      // Use IP address as default key
      return req.ip || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress || 
             'unknown';
    }
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const now = Date.now();

      // Get or create rate limit record
      let record = memoryStore.get(key);
      
      if (!record || now > record.resetTime) {
        // Create new record
        record = {
          count: 1,
          resetTime: now + windowMs
        };
        memoryStore.set(key, record);
      } else {
        // Increment count
        record.count++;
      }

      // Check if limit exceeded
      if (record.count > max) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        
        logger.warn(`Rate limit exceeded for ${key}: ${record.count}/${max}`, 'RateLimit');
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(record.resetTime).toISOString(),
          'Retry-After': retryAfter.toString()
        });

        return res.status(429).json({
          success: false,
          error: message,
          retryAfter
        });
      }

      // Set rate limit headers for successful requests
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': Math.max(0, max - record.count).toString(),
        'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
      });

      // Clean up expired records periodically
      if (Math.random() < 0.01) { // 1% chance to clean up
        cleanupExpiredRecords();
      }

      next();
    } catch (error) {
      logger.error(`Rate limiting middleware error: ${error}`, 'RateLimit');
      next();
    }
  };
}

// Clean up expired records
function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetTime) {
      memoryStore.delete(key);
    }
  }
}



// IP-based blocking for repeated violations
const blockedIPs = new Map<string, { blockedUntil: number; violationCount: number }>();

export function ipBlocker(maxViolations = 10, blockDuration = 60 * 60 * 1000) { // 1 hour block
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = ipKeyGenerator(req) as string;
    const now = Date.now();

    // Check if IP is blocked
    const blockRecord = blockedIPs.get(ip);
    if (blockRecord && now < blockRecord.blockedUntil) {
      const remainingTime = Math.ceil((blockRecord.blockedUntil - now) / 1000);
      logger.warn(`Blocked IP attempted access: ${ip}`, 'IPBlocker');
      
      return res.status(403).json({
        success: false,
        error: 'IP address temporarily blocked due to repeated violations',
        retryAfter: remainingTime
      });
    }

    // Clean up expired blocks
    if (blockRecord && now >= blockRecord.blockedUntil) {
      blockedIPs.delete(ip);
    }

    next();
  };
}

// Function to manually block an IP
export function blockIP(ip: string, duration = 60 * 60 * 1000) {
  const existing = blockedIPs.get(ip);
  blockedIPs.set(ip, {
    blockedUntil: Date.now() + duration,
    violationCount: (existing?.violationCount || 0) + 1
  });
  
  logger.warn(`IP blocked: ${ip} for ${duration}ms`, 'IPBlocker');
}

// Function to check if an IP is blocked
export function isIPBlocked(ip: string): boolean {
  const blockRecord = blockedIPs.get(ip);
  if (!blockRecord) return false;
  
  if (Date.now() >= blockRecord.blockedUntil) {
    blockedIPs.delete(ip);
    return false;
  }
  
  return true;
}

// Middleware to track violations and auto-block
export function violationTracker(maxViolations = 10, blockDuration = 60 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = ipKeyGenerator(req) as string;
    
    // Track rate limit violations
    const originalSend = res.send;
    res.send = function(data: unknown) {
      if (res.statusCode === 429) {
        const blockRecord = blockedIPs.get(ip) || { blockedUntil: 0, violationCount: 0 };
        blockRecord.violationCount++;
        
        if (blockRecord.violationCount >= maxViolations) {
          blockRecord.blockedUntil = Date.now() + blockDuration;
          blockedIPs.set(ip, blockRecord);
          logger.warn(`IP auto-blocked due to violations: ${ip}`, 'ViolationTracker');
        } else {
          blockedIPs.set(ip, blockRecord);
        }
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

// Clean up function for memory management
export function cleanup() {
  memoryStore.clear();
  blockedIPs.clear();
  logger.info('Rate limit stores cleaned up', 'RateLimit');
}

// Development function to clear rate limits
export function clearRateLimits() {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
    memoryStore.clear();
    logger.info('Development: Rate limits cleared', 'RateLimit');
  }
}

// Function to reset specific IP rate limit
export function resetIPLimit(ip: string) {
  const keysToDelete = [];
  for (const [key] of memoryStore.entries()) {
    if (key.startsWith(`api:${ip}:`) || key.startsWith(`auth:${ip}:`) || key.startsWith(`stream:${ip}:`)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => memoryStore.delete(key));
  
  if (keysToDelete.length > 0) {
    logger.info(`Rate limits cleared for IP: ${ip} (${keysToDelete.length} keys)`, 'RateLimit');
  }
  
  // Unblock IP if it was blocked
  if (blockedIPs.has(ip)) {
    blockedIPs.delete(ip);
    logger.info(`IP ${ip} unblocked`, 'RateLimit');
  }
}

// Express-rate-limit configurations
export const createApiRateLimit = () => expressRateLimit({
  windowMs: 60 * 1000, // 1 minute (reduced from 15 minutes)
  max: 1000, // Increased from 20 to 1000 requests per minute
  message: {
    error: 'Too many API requests, please try again later',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for ${req.ip}: API endpoint`, 'RateLimit');
    res.status(429).json({
      error: 'Too many API requests, please try again later',
      retryAfter: 60
    });
  }
});

export const createAuthRateLimit = () => expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 20 to 200 requests per 15 minutes
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: 15 * 60
  },
  keyGenerator: (req: Request) => {
    // Use IP + endpoint combination for auth attempts
    const ip = ipKeyGenerator(req) as string;
    const endpoint = req.path;
    return `auth:${ip}:${endpoint}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for ${req.ip}: Authentication endpoint`, 'RateLimit');
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later',
      retryAfter: 15 * 60
    });
  }
});

export const createStreamRateLimit = () => expressRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'Too many streaming requests, please try again later',
    retryAfter: 60
  },
  keyGenerator: (req: Request) => {
    // Use IP + camera ID for streaming
    const ip = ipKeyGenerator(req) as string;
    const cameraId = req.params.id || 'unknown';
    return `stream:${ip}:${cameraId}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for ${req.ip}: Streaming endpoint`, 'RateLimit');
    res.status(429).json({
      error: 'Too many streaming requests, please try again later',
      retryAfter: 60
    });
  }
});

// Helmet security middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      fontSrc: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

export default rateLimit;