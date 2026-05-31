import { Request, Response, NextFunction } from 'express';
import { authService, JWTPayload } from '../auth/index.js';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';

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
          const session = await AppDataSource.query(
            'SELECT id FROM user_sessions WHERE user_id = $1 AND is_active = true LIMIT 1',
            [payload.userId]
          );
          if (!session || session.length === 0) {
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
      logger.info(`User authenticated: ${payload.username} (${payload.role})`, 'AuthMiddleware');

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