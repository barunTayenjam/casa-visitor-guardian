import { Express, Request, Response } from 'express';
import { authService } from '../auth/index.js';
import { validate, commonSchemas } from '../middleware/validation.js';
import { createAuthRateLimit } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/auth.js';
import auditLogger from '../utils/auditLogger.js';
import { logger } from '../utils/logger.js';

export function configureAuthRoutes(app: Express) {
  // Register new user (ADMIN ONLY - public registration disabled)
  app.post('/api/auth/register',
    authenticate({ roles: ['admin'] }),
    validate({
      body: {
        username: {
          type: 'string' as const,
          required: true,
          minLength: 3,
          maxLength: 50,
          pattern: /^[a-zA-Z0-9_-]+$/
        },
        email: {
          type: 'email' as const,
          required: true,
          maxLength: 100
        },
        password: {
          type: 'string' as const,
          required: true,
          minLength: 8,
          maxLength: 128
        },
        role: {
          type: 'string' as const,
          required: false,
          enum: ['admin', 'user', 'viewer']
        }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const { username, email, password, role } = req.body;

        const result = await authService.register({
          username,
          email,
          password,
          role
        });

        if (result.success) {
          auditLogger.log({
            level: 'INFO',
            category: 'AUTH',
            action: 'USER_REGISTER',
            userId: result.user?.id,
            username: result.user?.username,
            ip: auditLogger.getClientIP(req),
            userAgent: req.get('User-Agent'),
            details: { email, role: role || 'user' },
            success: true
          });
          logger.info(`User registered successfully: ${username}`, 'AuthRoutes');
          return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: result.user,
            token: result.token
          });
        } else {
          auditLogger.log({
            level: 'WARN',
            category: 'AUTH',
            action: 'USER_REGISTER_FAILED',
            username: username,
            ip: auditLogger.getClientIP(req),
            userAgent: req.get('User-Agent'),
            details: { email, error: result.error },
            success: false
          });
          return res.status(400).json({
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        logger.error(`Registration error: ${error}`, 'AuthRoutes');
        return res.status(500).json({
          success: false,
          error: 'Registration failed'
        });
      }
    }
  );

  // Login user
  app.post('/api/auth/login',
    createAuthRateLimit(),
    validate({
      body: {
        username: {
          type: 'string' as const,
          required: true,
          minLength: 1
        },
        password: {
          type: 'string' as const,
          required: true,
          minLength: 1
        }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;

        const result = await authService.login({
          username,
          password
        });

        if (result.success) {
          auditLogger.log({
            level: 'INFO',
            category: 'AUTH',
            action: 'USER_LOGIN',
            userId: result.user?.id,
            username: result.user?.username,
            ip: auditLogger.getClientIP(req),
            userAgent: req.get('User-Agent'),
            details: { loginMethod: 'password' },
            success: true
          });
          logger.info(`User logged in successfully: ${username}`, 'AuthRoutes');
          return res.json({
            success: true,
            message: 'Login successful',
            user: result.user,
            token: result.token
          });
        } else {
          auditLogger.log({
            level: 'WARN',
            category: 'AUTH',
            action: 'USER_LOGIN_FAILED',
            username: username,
            ip: auditLogger.getClientIP(req),
            userAgent: req.get('User-Agent'),
            details: { error: result.error },
            success: false
          });
          return res.status(401).json({
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        logger.error(`Login error: ${error}`, 'AuthRoutes');
        return res.status(500).json({
          success: false,
          error: 'Login failed'
        });
      }
    }
  );

  // Get current user profile
  app.get('/api/auth/profile',
    authenticate(),
    (req: Request, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'User not authenticated'
          });
        }

        const user = authService.getUserById(req.user.userId);

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }

        res.json({
          success: true,
          user
        });
      } catch (error) {
        logger.error(`Profile error: ${error}`, 'AuthRoutes');
        return res.status(500).json({
          success: false,
          error: 'Failed to get profile'
        });
      }
    }
  );

  // Change password
  app.post('/api/auth/change-password',
    authenticate(),
    validate({
      body: {
        currentPassword: {
          type: 'string' as const,
          required: true,
          minLength: 1
        },
        newPassword: {
          type: 'string' as const,
          required: true,
          minLength: 8,
          maxLength: 128
        }
      }
    }),
    async (req: Request, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'User not authenticated'
          });
        }

        const { currentPassword, newPassword } = req.body;

        const result = await authService.changePassword(
          req.user.userId,
          currentPassword,
          newPassword
        );

        if (result.success) {
          logger.info(`Password changed for user: ${req.user.username}`, 'AuthRoutes');
          return res.json({
            success: true,
            message: 'Password changed successfully'
          });
        } else {
          return res.status(400).json({
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        logger.error(`Password change error: ${error}`, 'AuthRoutes');
        return res.status(500).json({
          success: false,
          error: 'Password change failed'
        });
      }
    }
  );

  // Refresh token
  app.post('/api/auth/refresh',
    authenticate(),
    (req: Request, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'User not authenticated'
          });
        }

        const user = authService.getUserById(req.user.userId);

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }

        let token: string;
        try {
          token = authService.generateToken(user as any);
        } catch (error) {
          logger.error(`Token refresh error during JWT signing: ${error}`, 'AuthRoutes');
          return res.status(500).json({
            success: false,
            error: 'Token refresh failed - JWT signing error'
          });
        }

        res.json({
          success: true,
          token
        });
      } catch (error) {
        logger.error(`Token refresh error: ${error}`, 'AuthRoutes');
        return res.status(500).json({
          success: false,
          error: 'Token refresh failed'
        });
      }
    }
  );

  // Logout (client-side token removal)
  app.post('/api/auth/logout',
    authenticate(),
    (req: Request, res: Response) => {
      try {
        auditLogger.log({
          level: 'INFO',
          category: 'AUTH',
          action: 'USER_LOGOUT',
          userId: req.user?.userId,
          username: req.user?.username,
          ip: auditLogger.getClientIP(req),
          userAgent: req.get('User-Agent'),
          success: true
        });
        logger.info(`User logged out: ${req.user?.username}`, 'AuthRoutes');
        res.json({
          success: true,
          message: 'Logout successful'
        });
      } catch (error) {
        auditLogger.log({
          level: 'ERROR',
          category: 'AUTH',
          action: 'USER_LOGOUT_FAILED',
          userId: req.user?.userId,
          username: req.user?.username,
          ip: auditLogger.getClientIP(req),
          userAgent: req.get('User-Agent'),
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          success: false
        });
        logger.error(`Logout error: ${error}`, 'AuthRoutes');
        return res.status(500).json({
          success: false,
          error: 'Logout failed'
        });
      }
    }
  );
}

export default configureAuthRoutes;