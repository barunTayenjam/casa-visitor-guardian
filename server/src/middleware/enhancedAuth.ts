import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { EventBus } from '../events/eventBus.js';
import { config } from '../config/index.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email?: string;
    role: string;
    iat?: number;
    exp?: number;
  };
  sessionId?: string;
}

export interface LoginAttempt {
  ip: string;
  username: string;
  timestamp: number;
  successful: boolean;
  userAgent?: string;
}

export interface SessionInfo {
  userId: string;
  username: string;
  ip: string;
  userAgent?: string;
  createdAt: Date;
  lastActivity: Date;
  sessionId: string;
}

export class EnhancedAuthMiddleware {
  private static instance: EnhancedAuthMiddleware;
  private loginAttempts = new Map<string, LoginAttempt[]>();
  private sessions = new Map<string, SessionInfo>();
  private eventBus: EventBus;
  
  // Security settings
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_SESSIONS_PER_USER = 5;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.startCleanupTimer();
  }

  static getInstance(): EnhancedAuthMiddleware {
    if (!EnhancedAuthMiddleware.instance) {
      EnhancedAuthMiddleware.instance = new EnhancedAuthMiddleware();
    }
    return EnhancedAuthMiddleware.instance;
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupOldLoginAttempts();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > this.SESSION_DURATION) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      const session = this.sessions.get(sessionId);
      if (session) {
        logger.info(`Session expired for user ${session.username}`, 'Auth');
        this.eventBus.emitEvent({
          type: 'system',
          data: {
            action: 'session_expired',
            userId: session.userId,
            username: session.username,
            ip: session.ip
          },
          source: 'AuthMiddleware',
          severity: 'low'
        });
      }
      this.sessions.delete(sessionId);
    }
    
    if (expiredSessions.length > 0) {
      logger.info(`Cleaned up ${expiredSessions.length} expired sessions`, 'Auth');
    }
  }

  private cleanupOldLoginAttempts(): void {
    const now = Date.now();
    const cutoffTime = now - this.LOCKOUT_DURATION;
    
    for (const [key, attempts] of this.loginAttempts) {
      const validAttempts = attempts.filter(attempt => attempt.timestamp > cutoffTime);
      if (validAttempts.length === 0) {
        this.loginAttempts.delete(key);
      } else if (validAttempts.length !== attempts.length) {
        this.loginAttempts.set(key, validAttempts);
      }
    }
  }

  private getLoginAttemptKey(ip: string, username: string): string {
    return `${ip}:${username}`;
  }

  private isRateLimited(ip: string, username: string): boolean {
    const key = this.getLoginAttemptKey(ip, username);
    const attempts = this.loginAttempts.get(key) || [];
    const recentAttempts = attempts.filter(attempt => 
      Date.now() - attempt.timestamp < this.LOCKOUT_DURATION
    );
    
    const failedAttempts = recentAttempts.filter(attempt => !attempt.successful);
    return failedAttempts.length >= this.MAX_LOGIN_ATTEMPTS;
  }

  private recordLoginAttempt(
    ip: string, 
    username: string, 
    successful: boolean, 
    userAgent?: string
  ): void {
    const key = this.getLoginAttemptKey(ip, username);
    const attempts = this.loginAttempts.get(key) || [];
    
    attempts.push({
      ip,
      username,
      timestamp: Date.now(),
      successful,
      userAgent
    });
    
    // Keep only recent attempts
    this.loginAttempts.set(key, attempts.filter(attempt => 
      Date.now() - attempt.timestamp < this.LOCKOUT_DURATION
    ));
    
    // Emit authentication event
    this.eventBus.emitEvent({
      type: successful ? 'system' : 'error',
      data: {
        action: successful ? 'login_success' : 'login_failed',
        username,
        ip,
        userAgent,
        timestamp: new Date()
      },
      source: 'AuthMiddleware',
      severity: successful ? 'low' : 'medium'
    });
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private createSession(
    userId: string, 
    username: string, 
    ip: string, 
    userAgent?: string
  ): string {
    // Check if user has too many active sessions
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId && session.username === username);
    
    if (userSessions.length >= this.MAX_SESSIONS_PER_USER) {
      // Remove oldest session
      const oldestSession = userSessions.reduce((oldest, current) => 
        current.createdAt < oldest.createdAt ? current : oldest
      );
      this.sessions.delete(oldestSession.sessionId);
      
      logger.warn(`Removed oldest session for user ${username} due to limit`, 'Auth');
    }
    
    const sessionId = this.generateSessionId();
    const session: SessionInfo = {
      userId,
      username,
      ip,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      sessionId
    };
    
    this.sessions.set(sessionId, session);
    
    logger.info(`Created session for user ${username}`, 'Auth');
    return sessionId;
  }

  private updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.sessions.set(sessionId, session);
    }
  }

  private validateJWT(token: string): any {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'home-security-system',
        audience: 'home-security-clients'
      });
      
      return decoded;
    } catch (error) {
      logger.warn(`JWT validation failed: ${(error as Error).message}`, 'Auth');
      return null;
    }
  }

  // Middleware functions
  authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const tokenFromCookie = req.cookies?.authToken;
      
      let token = null;
      
      // Get token from Authorization header
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
      // Fall back to cookie
      else if (tokenFromCookie) {
        token = tokenFromCookie;
      }
      
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }
      
      // Validate JWT
      const decoded = this.validateJWT(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'TOKEN_INVALID'
        });
        return;
      }
      
      // Check if session is still active
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.userId !== decoded.id) {
          res.status(401).json({
            success: false,
            error: 'Session expired or invalid',
            code: 'SESSION_INVALID'
          });
          return;
        }
        
        // Update session activity
        this.updateSessionActivity(sessionId);
        req.sessionId = sessionId;
      }
      
      // Attach user to request
      req.user = decoded;
      
      next();
    } catch (error) {
      logger.error(`Authentication middleware error: ${(error as Error).message}`, 'Auth');
      res.status(500).json({
        success: false,
        error: 'Authentication service unavailable',
        code: 'AUTH_ERROR'
      });
    }
  };

  requireRole = (requiredRoles: string | string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }
      
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      
      if (!roles.includes(req.user.role)) {
        logger.warn(`Access denied for user ${req.user.username} (role: ${req.user.role})`, 'Auth');
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: req.user.role
        });
        return;
      }
      
      next();
    };
  };

  rateLimitLogin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const { username } = req.body;
    
    if (!username) {
      res.status(400).json({
        success: false,
        error: 'Username is required',
        code: 'USERNAME_REQUIRED'
      });
      return;
    }
    
    // Check if rate limited
    if (this.isRateLimited(ip, username)) {
      logger.warn(`Login rate limit exceeded for ${username} from ${ip}`, 'Auth');
      res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(this.LOCKOUT_DURATION / 1000 / 60) // minutes
      });
      return;
    }
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    let responseSent = false;
    
    res.json = function(data: any) {
      if (responseSent) return;
      responseSent = true;
      
      const successful = res.statusCode < 400;
      EnhancedAuthMiddleware.getInstance().recordLoginAttempt(
        ip, 
        username, 
        successful, 
        req.get('User-Agent')
      );
      
      return originalJson.call(this, data);
    };
    
    next();
  };

  createSessionMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }
    
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent');
    
    // Create session if user is authenticated but no session exists
    if (!req.sessionId && req.user) {
      const sessionId = this.createSession(
        req.user.id,
        req.user.username,
        ip,
        userAgent
      );
      
      // Set session cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: this.SESSION_DURATION
      });
      
      req.sessionId = sessionId;
    }
    
    next();
  };

  // Utility methods
  invalidateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    this.sessions.delete(sessionId);
    logger.info(`Invalidated session for user ${session.username}`, 'Auth');
    
    this.eventBus.emitEvent({
      type: 'system',
      data: {
        action: 'session_invalidated',
        userId: session.userId,
        username: session.username,
        ip: session.ip
      },
      source: 'AuthMiddleware',
      severity: 'low'
    });
    
    return true;
  }

  invalidateAllUserSessions(userId: string): number {
    let invalidatedCount = 0;
    const sessionsToInvalidate: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        sessionsToInvalidate.push(sessionId);
      }
    }
    
    for (const sessionId of sessionsToInvalidate) {
      if (this.invalidateSession(sessionId)) {
        invalidatedCount++;
      }
    }
    
    return invalidatedCount;
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getUserSessions(userId: string): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId);
  }

  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
    topIPs: Array<{ ip: string; count: number }>;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();
    
    // Calculate average session duration
    const totalDuration = sessions.reduce((sum, session) => 
      sum + (now - session.createdAt.getTime()), 0
    );
    const averageDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;
    
    // Count sessions by IP
    const ipCounts = new Map<string, number>();
    for (const session of sessions) {
      ipCounts.set(session.ip, (ipCounts.get(session.ip) || 0) + 1);
    }
    
    const topIPs = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => now - s.lastActivity.getTime() < this.SESSION_DURATION).length,
      averageSessionDuration: averageDuration,
      topIPs
    };
  }

  // Logout middleware
  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const sessionId = req.sessionId || req.cookies?.sessionId;
    
    if (sessionId) {
      this.invalidateSession(sessionId);
    }
    
    // Clear auth cookie
    res.clearCookie('authToken');
    res.clearCookie('sessionId');
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  };
}

export default EnhancedAuthMiddleware;