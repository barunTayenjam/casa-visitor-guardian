import { Request, Response, NextFunction } from 'express';
import { authService, JWTPayload } from '../auth/index.js';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';
import cacheService from '../services/cacheService.js';

// Extend Request interface to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: JWTPayload;
  }
}

export interface AuthOptions {
  required?: boolean;
  roles?: string[];
  skipValidation?: boolean;
}

// Cache session validity per-user to avoid a DB round-trip on every request.
// TTL bounds the window a logged-out user could keep using cached sessions.
const SESSION_CHECK_TTL_SECONDS = 30;

function sessionCacheKey(userId: string): string {
  return `auth:session:${userId}`;
}

export function invalidateSessionCache(userId: string): void {
  void cacheService.del(sessionCacheKey(userId));
}

async function hasActiveSession(userId: string): Promise<boolean> {
  const cached = await cacheService.get(sessionCacheKey(userId));
  if (cached !== null) {
    return cached === '1';
  }

  const session = await AppDataSource.query(
    'SELECT id FROM user_sessions WHERE user_id = $1 AND is_active = true LIMIT 1',
    [userId]
  );
  const active = !!session && session.length > 0;
  await cacheService.set(sessionCacheKey(userId), active ? '1' : '0', SESSION_CHECK_TTL_SECONDS);
  return active;
}

export function authenticate(options: AuthOptions = {}) {
  const { required = true, roles = [], skipValidation = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;

      // If no token and authentication is required
      if (!token) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Authentication token is required'
          });
        }
        return next(); // Continue without authentication
      }

      // Verify token
      const payload = authService.verifyToken(token);

      if (!payload) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired authentication token'
          });
        }
        return next(); // Continue without authentication
      }

      // Check role requirements
      if (roles.length > 0 && !roles.includes(payload.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      // Verify user has an active session (not logged out)
      try {
        if (AppDataSource.isInitialized) {
          const active = await hasActiveSession(payload.userId);
          if (!active) {
            if (required) {
              return res.status(401).json({
                success: false,
                error: 'Session expired. Please login again.'
              });
            }
            return next();
          }
        }
      } catch (err) {
        logger.error(`Session check error: ${err}`, 'AuthMiddleware');
        if (required) {
          return res.status(500).json({
            success: false,
            error: 'Authentication error'
          });
        }
        return next();
      }

      // Add user payload to request
      req.user = payload;

      // Log authentication success
      logger.debug(`User authenticated: ${payload.username} (${payload.role})`, 'AuthMiddleware');

      next();
    } catch (error) {
      logger.error(`Authentication middleware error: ${error}`, 'AuthMiddleware');
      
      if (required) {
        return res.status(500).json({
          success: false,
          error: 'Authentication error'
        });
      }
      
      next();
    }
  };
}

// Role-based authentication helpers
export const requireAdmin = authenticate({ roles: ['admin'] });
export const requireUser = authenticate({ roles: ['admin', 'user'] });
export const requireViewer = authenticate({ roles: ['admin', 'user', 'viewer'] });
export const optionalAuth = authenticate({ required: false });

export default authenticate;