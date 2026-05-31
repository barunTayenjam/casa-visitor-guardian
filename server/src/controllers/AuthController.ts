import { Request, Response } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { BaseController } from './BaseController.js';
import authService, { AuthService, User } from '../auth/index.js';
import { config } from '../config/index.js';
import { AppDataSource } from '../database.js';
import auditLogger from '../utils/auditLogger.js';
import { logger } from '../utils/logger.js';

export class AuthController extends BaseController {
  private authService: AuthService;

  constructor(authServiceInstance: AuthService) {
    super();
    this.authService = authServiceInstance;
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password, role } = req.body;
      const result = await this.authService.register({ username, email, password, role });

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
        this.created(res, {
          message: 'User registered successfully',
          user: result.user as Record<string, unknown>,
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
        this.badRequest(res, result.error || 'Registration failed');
      }
    } catch (error) {
      this.serverError(res, error, 'register');
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      const result = await this.authService.login({ username, password });

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
        if (result.user?.id && result.token) {
      const sessionIp1 = req.ip && req.ip !== '' ? req.ip : '0.0.0.0';
          await AppDataSource.query(
            `INSERT INTO user_sessions (id, user_id, refresh_token, access_token_hash, ip_address, user_agent, device_info, is_active, expires_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, '{}'::jsonb, true, NOW() + INTERVAL '7 days')`,
            [result.user.id, result.token, result.token, sessionIp1, req.get('User-Agent') || '']
          ).catch(err => logger.error(`Failed to create user session: ${err}`, 'AuthRoutes'));
        }
        logger.info(`User logged in successfully: ${username}`, 'AuthRoutes');
        this.ok(res, {
          message: 'Login successful',
          user: result.user as Record<string, unknown>,
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
        res.status(401).json({ success: false, error: result.error });
      }
    } catch (error) {
      this.serverError(res, error, 'login');
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const user = await this.authService.getUserById(req.user.userId);

      if (!user) {
        this.notFound(res, 'User not found');
        return;
      }

      this.ok(res, { user: user as unknown as Record<string, unknown> });
    } catch (error) {
      this.serverError(res, error, 'getProfile');
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      const result = await this.authService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword
      );

      if (result.success) {
        logger.info(`Password changed for user: ${req.user.username}`, 'AuthRoutes');
        this.ok(res, { message: 'Password changed successfully' });
      } else {
        this.badRequest(res, result.error || 'Password change failed');
      }
    } catch (error) {
      this.serverError(res, error, 'changePassword');
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

      if (!token) {
        res.status(401).json({ success: false, error: 'No token provided' });
        return;
      }

      const payload = this.authService.verifyToken(token);

      if (!payload) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }

      const user = await this.authService.getUserById(payload.userId);

      if (!user) {
        this.notFound(res, 'User not found');
        return;
      }

      try {
        const userForToken: User = {
          id: user.id,
          username: user.username,
          email: user.email,
          password: '',
          role: user.role,
          isActive: user.isActive,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        };
        const newToken = this.authService.generateToken(userForToken);
        this.ok(res, { token: newToken });
      } catch (error) {
        logger.error(`Token refresh error during JWT signing: ${error}`, 'AuthRoutes');
        this.serverError(res, error, 'Token refresh failed - JWT signing error');
      }
    } catch (error) {
      this.serverError(res, error, 'refreshToken');
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
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
      if (req.user?.userId) {
        await AppDataSource.query(
          'DELETE FROM user_sessions WHERE user_id = $1',
          [req.user.userId]
        ).catch(err => logger.error(`Failed to delete user sessions on logout: ${err}`, 'AuthRoutes'));
      }
      logger.info(`User logged out: ${req.user?.username}`, 'AuthRoutes');
      this.ok(res, { message: 'Logout successful' });
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
      this.serverError(res, error, 'logout');
    }
  }

  async disableMfa(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      await AppDataSource.query(
        'UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW() WHERE id = $1',
        [userId]
      );

      auditLogger.log({
        level: 'INFO',
        category: 'AUTH',
        action: 'MFA_DISABLED',
        userId: req.user?.userId,
        username: req.user?.username,
        ip: auditLogger.getClientIP(req),
        userAgent: req.get('User-Agent'),
        success: true,
      });

      this.ok(res, { message: 'MFA disabled successfully' });
    } catch (error) {
      this.serverError(res, error, 'disableMfa');
    }
  }

  async setupMfa(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const secret = speakeasy.generateSecret({
        name: `SentryVision:${req.user?.username || userId}`,
        length: 20,
      });

      await AppDataSource.query(
        'UPDATE users SET mfa_secret = $1, updated_at = NOW() WHERE id = $2',
        [secret.base32, userId]
      );

      const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

      this.ok(res, {
        secret: secret.base32,
        qrCode,
      });
    } catch (error) {
      this.serverError(res, error, 'setupMfa');
    }
  }

  async mfaChallenge(req: Request, res: Response): Promise<void> {
    try {
      const { pendingToken, code } = req.body;
      if (!pendingToken || !code) {
        this.badRequest(res, 'pendingToken and code are required');
        return;
      }

      let payload: { userId: string; purpose: string };
      try {
        const decoded = jwt.verify(pendingToken, config.jwtSecret) as { userId: string; purpose: string };
        payload = decoded;
      } catch {
        res.status(401).json({ success: false, error: 'Invalid or expired pending token' });
        return;
      }

      if (payload.purpose !== 'mfa') {
        res.status(401).json({ success: false, error: 'Invalid token purpose' });
        return;
      }

      const [user] = await AppDataSource.query(
        'SELECT mfa_secret, username, email FROM users WHERE id = $1',
        [payload.userId]
      );

      if (!user || !user.mfa_secret) {
        this.badRequest(res, 'MFA not configured');
        return;
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (!verified) {
        auditLogger.log({
          level: 'WARN',
          category: 'AUTH',
          action: 'MFA_CHALLENGE_FAILED',
          userId: payload.userId,
          ip: auditLogger.getClientIP(req),
          userAgent: req.get('User-Agent'),
          success: false,
        });
        this.badRequest(res, 'Invalid MFA code');
        return;
      }

      const result = await AppDataSource.query(
        `SELECT u.id, u.username, u.email, u.status, r.name as role_name, u.created_at, u.updated_at
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [payload.userId]
      );

      const dbUser = result[0];
      const userForToken: User = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        password: '',
        role: dbUser.role_name as 'admin' | 'user' | 'viewer' || 'user',
        isActive: dbUser.status === 'active',
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
      };

      const token = this.authService.generateToken(userForToken);

      auditLogger.log({
        level: 'INFO',
        category: 'AUTH',
        action: 'MFA_CHALLENGE_SUCCESS',
        userId: payload.userId,
        username: dbUser.username,
        ip: auditLogger.getClientIP(req),
        userAgent: req.get('User-Agent'),
        success: true,
      });

      const sessionIp2 = req.ip && req.ip !== '' ? req.ip : '0.0.0.0';
      await AppDataSource.query(
        `INSERT INTO user_sessions (id, user_id, refresh_token, access_token_hash, ip_address, user_agent, device_info, is_active, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, '{}'::jsonb, true, NOW() + INTERVAL '7 days')`,
         [dbUser.id, token, token, sessionIp2, req.get('User-Agent') || '']
      ).catch(err => logger.error(`Failed to create user session: ${err}`, 'AuthRoutes'));

      const { password: _, ...userWithoutPassword } = userForToken;
      this.ok(res, {
        message: 'Login successful',
        user: userWithoutPassword as unknown as Record<string, unknown>,
        token,
      });
    } catch (error) {
      this.serverError(res, error, 'mfaChallenge');
    }
  }

  async verifyMfa(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.body;
      if (!code) {
        this.badRequest(res, 'MFA code is required');
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const [user] = await AppDataSource.query(
        'SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1',
        [userId]
      );

      if (!user || !user.mfa_secret) {
        this.badRequest(res, 'MFA not set up. Call setup first.');
        return;
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      if (verified) {
        if (!user.mfa_enabled) {
          await AppDataSource.query(
            'UPDATE users SET mfa_enabled = true, updated_at = NOW() WHERE id = $1',
            [userId]
          );
        }

        auditLogger.log({
          level: 'INFO',
          category: 'AUTH',
          action: 'MFA_VERIFIED',
          userId: req.user?.userId,
          username: req.user?.username,
          ip: auditLogger.getClientIP(req),
          userAgent: req.get('User-Agent'),
          success: true,
        });
        this.ok(res, { message: 'MFA verified successfully' });
      } else {
        this.badRequest(res, 'Invalid MFA code');
      }
    } catch (error) {
      this.serverError(res, error, 'verifyMfa');
    }
  }
}

export const authController = new AuthController(authService);
