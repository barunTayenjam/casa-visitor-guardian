import { DataSource, Repository } from 'typeorm';
import { User } from '../models';
import { JWTService } from '../utils/jwtService';
import { AuditService } from '../utils/auditService';
import { z } from 'zod';
import crypto from 'crypto';

// Zod schemas for validation
export const SessionCreateSchema = z.object({
  userId: z.string(),
  deviceInfo: z.object({
    userAgent: z.string(),
    ip: z.string(),
    platform: z.string().optional(),
    browser: z.string().optional(),
    device: z.string().optional(),
    os: z.string().optional()
  }),
  rememberMe: z.boolean().default(false),
  sessionType: z.enum(['web', 'mobile', 'api', 'desktop']).default('web')
});

export const SessionUpdateSchema = z.object({
  sessionId: z.string(),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    ip: z.string().optional(),
    platform: z.string().optional(),
    browser: z.string().optional(),
    device: z.string().optional(),
    os: z.string().optional()
  }).optional()
});

export const SessionTerminateSchema = z.object({
  sessionId: z.string(),
  reason: z.enum(['user_logout', 'admin_terminate', 'security_violation', 'timeout', 'password_change']).default('user_logout')
});

export interface SessionInfo {
  id: string;
  userId: string;
  username: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    platform?: string;
    browser?: string;
    device?: string;
    os?: string;
  };
  isActive: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
  location?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SessionSecurityInfo {
  sessionId: string;
  riskFactors: string[];
  anomalies: string[];
  recommendations: string[];
  actionRequired: boolean;
}

export interface SessionPolicy {
  maxConcurrentSessions: number;
  sessionTimeout: number; // minutes
  absoluteTimeout: number; // hours
  idleTimeout: number; // minutes
  requireReauthAfter: number; // hours
  allowedSessionTypes: string[];
  ipRestriction: boolean;
  geoRestriction: boolean;
  deviceFingerprinting: boolean;
}

export class SessionManager {
  private sessionRepository: Repository<Session>;
  private userRepository: Repository<User>;
  private jwtService: JWTService;
  private auditService: AuditService;
  private sessionPolicy: SessionPolicy;
  private activeSessions: Map<string, SessionInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private dataSource: DataSource,
    jwtService?: JWTService,
    auditService?: AuditService,
    sessionPolicy?: Partial<SessionPolicy>
  ) {
    this.sessionRepository = dataSource.getRepository(Session);
    this.userRepository = dataSource.getRepository(User);
    this.jwtService = jwtService || new JWTService();
    this.auditService = auditService || new AuditService(dataSource);
    
    this.sessionPolicy = {
      maxConcurrentSessions: 5,
      sessionTimeout: 30,
      absoluteTimeout: 24,
      idleTimeout: 15,
      requireReauthAfter: 8,
      allowedSessionTypes: ['web', 'mobile', 'api', 'desktop'],
      ipRestriction: true,
      geoRestriction: false,
      deviceFingerprinting: true,
      ...sessionPolicy
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async createSession(sessionData: z.infer<typeof SessionCreateSchema>): Promise<{
    success: boolean;
    session?: SessionInfo;
    tokens?: { accessToken: string; refreshToken: string; expiresIn: number };
    error?: string;
  }> {
    try {
      // Validate input
      const validated = SessionCreateSchema.parse(sessionData);

      // Check user exists and is active
      const user = await this.userRepository.findOne({
        where: { id: validated.userId, isActive: true }
      });

      if (!user) {
        return { success: false, error: 'User not found or inactive' };
      }

      // Check concurrent session limit
      const activeSessionCount = await this.sessionRepository.count({
        where: { user: { id: validated.userId }, isActive: true }
      });

      if (activeSessionCount >= this.sessionPolicy.maxConcurrentSessions) {
        // Terminate oldest session
        await this.terminateOldestSession(validated.userId);
      }

      // Generate session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const refreshToken = crypto.randomBytes(32).toString('hex');

      // Calculate expiration times
      const now = new Date();
      const sessionExpires = new Date(now.getTime() + this.sessionPolicy.sessionTimeout * 60 * 1000);
      const absoluteExpires = new Date(now.getTime() + this.sessionPolicy.absoluteTimeout * 60 * 60 * 1000);

      // Create session record
      const session = await this.sessionRepository.save({
        user,
        sessionToken,
        refreshToken,
        deviceInfo: validated.deviceInfo.userAgent,
        ipAddress: validated.deviceInfo.ip,
        platform: validated.deviceInfo.platform,
        browser: validated.deviceInfo.browser,
        device: validated.deviceInfo.device,
        os: validated.deviceInfo.os,
        sessionType: validated.sessionType,
        isActive: true,
        createdAt: now,
        lastActivityAt: now,
        expiresAt: sessionExpires,
        absoluteExpiresAt: absoluteExpires,
        location: await this.getLocationFromIP(validated.deviceInfo.ip),
        riskLevel: 'low'
      });

      // Generate JWT tokens
      const tokens = await this.jwtService.generateTokenPair({
        userId: user.id,
        username: user.username,
        email: user.email,
        roleId: user.role?.id,
        permissions: user.role?.permissions || []
      });

      // Create session info
      const sessionInfo: SessionInfo = {
        id: session.id,
        userId: user.id,
        username: user.username,
        deviceInfo: validated.deviceInfo,
        isActive: session.isActive,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        isCurrent: true,
        location: session.location,
        riskLevel: session.riskLevel
      };

      // Cache session info
      this.activeSessions.set(sessionToken, sessionInfo);

      // Log session creation
      await this.auditService.logEvent({
        userId: user.id,
        action: 'SESSION_CREATED',
        resource: 'session',
        resourceId: session.id,
        details: {
          sessionType: validated.sessionType,
          deviceInfo: validated.deviceInfo,
          rememberMe: validated.rememberMe
        },
        ipAddress: validated.deviceInfo.ip,
        userAgent: validated.deviceInfo.userAgent,
        severity: 'medium',
        category: 'authentication'
      });

      return {
        success: true,
        session: sessionInfo,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        }
      };

    } catch (error) {
      console.error('Session creation error:', error);
      return { success: false, error: 'Failed to create session' };
    }
  }

  async updateSessionActivity(sessionToken: string, deviceInfo?: any): Promise<boolean> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { sessionToken, isActive: true },
        relations: ['user']
      });

      if (!session) {
        return false;
      }

      const now = new Date();
      
      // Update session activity
      await this.sessionRepository.update(session.id, {
        lastActivityAt: now,
        deviceInfo: deviceInfo?.userAgent || session.deviceInfo,
        ipAddress: deviceInfo?.ip || session.ipAddress
      });

      // Update cached session info
      const cachedSession = this.activeSessions.get(sessionToken);
      if (cachedSession) {
        cachedSession.lastActivityAt = now;
        if (deviceInfo) {
          cachedSession.deviceInfo = { ...cachedSession.deviceInfo, ...deviceInfo };
        }
      }

      return true;

    } catch (error) {
      console.error('Session activity update error:', error);
      return false;
    }
  }

  async validateSession(sessionToken: string): Promise<{
    isValid: boolean;
    session?: SessionInfo;
    error?: string;
  }> {
    try {
      // Check cache first
      const cachedSession = this.activeSessions.get(sessionToken);
      if (cachedSession) {
        // Check if session is still valid
        if (cachedSession.expiresAt < new Date()) {
          this.activeSessions.delete(sessionToken);
          return { isValid: false, error: 'Session expired' };
        }
        return { isValid: true, session: cachedSession };
      }

      // Check database
      const session = await this.sessionRepository.findOne({
        where: { sessionToken, isActive: true },
        relations: ['user']
      });

      if (!session) {
        return { isValid: false, error: 'Session not found' };
      }

      // Check expiration
      if (session.expiresAt < new Date()) {
        await this.terminateSession(session.id, 'timeout');
        return { isValid: false, error: 'Session expired' };
      }

      // Check absolute expiration
      if (session.absoluteExpiresAt && session.absoluteExpiresAt < new Date()) {
        await this.terminateSession(session.id, 'timeout');
        return { isValid: false, error: 'Session expired (absolute)' };
      }

      // Check idle timeout
      const idleTime = Date.now() - session.lastActivityAt.getTime();
      if (idleTime > this.sessionPolicy.idleTimeout * 60 * 1000) {
        await this.terminateSession(session.id, 'timeout');
        return { isValid: false, error: 'Session expired (idle)' };
      }

      // Create session info and cache it
      const sessionInfo: SessionInfo = {
        id: session.id,
        userId: session.user.id,
        username: session.user.username,
        deviceInfo: {
          userAgent: session.deviceInfo,
          ip: session.ipAddress,
          platform: session.platform,
          browser: session.browser,
          device: session.device,
          os: session.os
        },
        isActive: session.isActive,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        isCurrent: true,
        location: session.location,
        riskLevel: session.riskLevel
      };

      this.activeSessions.set(sessionToken, sessionInfo);

      return { isValid: true, session: sessionInfo };

    } catch (error) {
      console.error('Session validation error:', error);
      return { isValid: false, error: 'Session validation failed' };
    }
  }

  async terminateSession(sessionId: string, reason: string = 'user_logout'): Promise<boolean> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId, isActive: true },
        relations: ['user']
      });

      if (!session) {
        return false;
      }

      // Update session
      await this.sessionRepository.update(session.id, {
        isActive: false,
        loggedOutAt: new Date(),
        logoutReason: reason
      });

      // Remove from cache
      this.activeSessions.delete(session.sessionToken);

      // Blacklist JWT token
      await this.jwtService.blacklistToken(session.refreshToken);

      // Log session termination
      await this.auditService.logEvent({
        userId: session.user.id,
        action: 'SESSION_TERMINATED',
        resource: 'session',
        resourceId: session.id,
        details: { reason },
        ipAddress: session.ipAddress,
        userAgent: session.deviceInfo,
        severity: 'medium',
        category: 'authentication'
      });

      return true;

    } catch (error) {
      console.error('Session termination error:', error);
      return false;
    }
  }

  async terminateAllUserSessions(userId: string, excludeSessionId?: string): Promise<number> {
    try {
      const sessions = await this.sessionRepository.find({
        where: { user: { id: userId }, isActive: true }
      });

      let terminatedCount = 0;

      for (const session of sessions) {
        if (excludeSessionId && session.id === excludeSessionId) {
          continue;
        }

        await this.terminateSession(session.id, 'admin_terminate');
        terminatedCount++;
      }

      return terminatedCount;

    } catch (error) {
      console.error('Terminate all sessions error:', error);
      return 0;
    }
  }

  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const sessions = await this.sessionRepository.find({
        where: { user: { id: userId } },
        order: { lastActivityAt: 'DESC' }
      });

      return sessions.map(session => ({
        id: session.id,
        userId: session.user.id,
        username: session.user.username,
        deviceInfo: {
          userAgent: session.deviceInfo,
          ip: session.ipAddress,
          platform: session.platform,
          browser: session.browser,
          device: session.device,
          os: session.os
        },
        isActive: session.isActive,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        isCurrent: false,
        location: session.location,
        riskLevel: session.riskLevel
      }));

    } catch (error) {
      console.error('Get user sessions error:', error);
      return [];
    }
  }

  async analyzeSessionSecurity(sessionId: string): Promise<SessionSecurityInfo> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['user']
      });

      if (!session) {
        return {
          sessionId,
          riskFactors: ['Session not found'],
          anomalies: [],
          recommendations: [],
          actionRequired: true
        };
      }

      const riskFactors: string[] = [];
      const anomalies: string[] = [];
      const recommendations: string[] = [];

      // Check session age
      const sessionAge = Date.now() - session.createdAt.getTime();
      if (sessionAge > 24 * 60 * 60 * 1000) { // 24 hours
        riskFactors.push('Long-lived session');
        recommendations.push('Consider reducing session timeout');
      }

      // Check IP address changes
      if (session.ipAddress !== session.lastLoginIp) {
        anomalies.push('IP address changed during session');
        riskFactors.push('Potential session hijacking');
        recommendations.push('Verify user identity');
      }

      // Check device fingerprint
      if (session.deviceFingerprint && session.deviceFingerprint !== session.lastDeviceFingerprint) {
        anomalies.push('Device fingerprint changed');
        riskFactors.push('Potential session hijacking');
        recommendations.push('Re-authenticate user');
      }

      // Check geographic location
      if (session.location && session.lastLocation && session.location !== session.lastLocation) {
        anomalies.push('Geographic location changed');
        riskFactors.push('Impossible travel detected');
        recommendations.push('Verify user location');
      }

      // Check concurrent sessions
      const concurrentSessions = await this.sessionRepository.count({
        where: { user: { id: session.user.id }, isActive: true }
      });

      if (concurrentSessions > 3) {
        riskFactors.push('Multiple concurrent sessions');
        recommendations.push('Review active sessions');
      }

      return {
        sessionId,
        riskFactors,
        anomalies,
        recommendations,
        actionRequired: riskFactors.length > 0 || anomalies.length > 0
      };

    } catch (error) {
      console.error('Session security analysis error:', error);
      return {
        sessionId,
        riskFactors: ['Security analysis failed'],
        anomalies: [],
        recommendations: [],
        actionRequired: true
      };
    }
  }

  private async terminateOldestSession(userId: string): Promise<boolean> {
    try {
      const oldestSession = await this.sessionRepository.findOne({
        where: { user: { id: userId }, isActive: true },
        order: { lastActivityAt: 'ASC' }
      });

      if (oldestSession) {
        return await this.terminateSession(oldestSession.id, 'concurrent_limit');
      }

      return false;

    } catch (error) {
      console.error('Terminate oldest session error:', error);
      return false;
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      
      // Find expired sessions
      const expiredSessions = await this.sessionRepository.find({
        where: [
          { isActive: true, expiresAt: () => '< :now' },
          { isActive: true, absoluteExpiresAt: () => '< :now' }
        ],
        relations: ['user']
      });

      for (const session of expiredSessions) {
        await this.terminateSession(session.id, 'timeout');
      }

      // Clean up cache
      for (const [token, sessionInfo] of this.activeSessions.entries()) {
        if (sessionInfo.expiresAt < now) {
          this.activeSessions.delete(token);
        }
      }

      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);

    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  private async getLocationFromIP(ipAddress: string): Promise<string> {
    // This would typically use a geolocation service
    // For now, return a placeholder
    try {
      // Simple implementation - in production, use a proper geolocation service
      if (ipAddress === '127.0.0.1' || ipAddress === '::1') {
        return 'Localhost';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.cleanupExpiredSessions();
    this.activeSessions.clear();
  }
}