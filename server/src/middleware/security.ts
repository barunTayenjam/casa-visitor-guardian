import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '../utils/logger.js';

// HTTPS enforcement middleware
export function enforceHTTPS(req: Request, res: Response, next: NextFunction) {
  // Skip in development or if already HTTPS
  if (process.env.NODE_ENV === 'development' || req.secure) {
    return next();
  }

  // Check for x-forwarded-proto header (behind reverse proxy)
  const proto = req.get('x-forwarded-proto');
  if (proto === 'https') {
    return next();
  }

  // Redirect to HTTPS
  const httpsUrl = `https://${req.get('host')}${req.url}`;
  logger.warn(`Redirecting HTTP request to HTTPS: ${req.url} -> ${httpsUrl}`, 'SecurityMiddleware');
  
  // Use 301 for permanent redirect, 302 for temporary
  const statusCode = process.env.NODE_ENV === 'production' ? 301 : 302;
  res.redirect(statusCode, httpsUrl);
}

// Custom security headers middleware
export function customSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 
    'geolocation=(), ' +
    'microphone=(), ' +
    'camera=(), ' +
    'magnetometer=(), ' +
    'gyroscope=(), ' +
    'speaker=(), ' +
    'notifications=(), ' +
    'push=(), ' +
    'midi=(), ' +
    'vibrate=(), ' +
    'fullscreen=(self), ' +
    'payment=(), ' +
    'encrypted-media=(self)'
  );
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for development
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
}

// API rate limiting for sensitive endpoints
export function createApiRateLimit(options: {
  windowMs?: number;
  max?: number;
  message?: string;
} = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max = options.max || 100; // 100 requests per window
  const message = options.message || 'Too many requests from this IP, please try again later.';
  
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}:${req.path}`;
    
    // Clean up expired entries
    for (const [k, v] of requests.entries()) {
      if (now > v.resetTime) {
        requests.delete(k);
      }
    }
    
    // Check current requests
    const current = requests.get(key);
    
    if (!current) {
      // First request
      requests.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (current.count >= max) {
      logger.warn(`Rate limit exceeded for IP ${ip} on ${req.path}`, 'SecurityMiddleware');
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }
    
    // Increment count
    current.count++;
    next();
  };
}

// Request validation middleware
export function validateRequest(req: Request, res: Response, next: NextFunction) {
  // Check for common attack patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
    /union\s+select/gi, // SQL injection
    /drop\s+table/gi, // SQL injection
    /insert\s+into/gi, // SQL injection
    /delete\s+from/gi, // SQL injection
    /eval\s*\(/gi, // Code injection
    /exec\s*\(/gi, // Code injection
  ];
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };
  
  // Check URL, query parameters, and body
  const urlCheck = suspiciousPatterns.some(pattern => pattern.test(req.url));
  const queryCheck = checkValue(req.query);
  const bodyCheck = checkValue(req.body);
  
  if (urlCheck || queryCheck || bodyCheck) {
    logger.warn(`Suspicious request detected from IP ${req.ip}: ${req.method} ${req.url}`, 'SecurityMiddleware');
    return res.status(400).json({
      success: false,
      error: 'Invalid request detected'
    });
  }
  
  next();
}

// API key validation for external integrations
export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.get('X-API-Key');
  const validApiKeys = process.env.API_KEYS?.split(',') || [];
  
  // Skip API key validation for authentication endpoints
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }
  
  // Skip if no API keys are configured (for development)
  if (validApiKeys.length === 0) {
    return next();
  }
  
  if (!apiKey || !validApiKeys.includes(apiKey)) {
    logger.warn(`Invalid API key provided from IP ${req.ip}`, 'SecurityMiddleware');
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key'
    });
  }
  
  next();
}

// Configure helmet with custom options
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: false, // We handle CSP separately
    crossOriginEmbedderPolicy: false, // May break some functionality
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false
  });
}

export default {
  enforceHTTPS,
  customSecurityHeaders,
  createApiRateLimit,
  validateRequest,
  validateApiKey,
  configureHelmet
};