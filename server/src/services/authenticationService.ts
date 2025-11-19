import { DataSource, Repository } from 'typeorm';
import { User, Role, Session, AuditLog, PasswordHistory } from '../models';
import { PasswordSecurityService, defaultPasswordPolicy } from '../utils/passwordSecurity';
import { JWTService } from '../utils/jwtService';
import { AuditService } from '../utils/auditService';
import { z } from 'zod';
import crypto from 'crypto';

// Zod schemas for validation
export const RegisterRequestSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(12).max(256),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional()
});

export const LoginRequestSchema = z.object({
  identifier: z.string().min(1), // username or email
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  deviceInfo: z.object({
    userAgent: z.string(),
    ip: z.string(),
    platform: z.string().optional(),
    browser: z.string().optional()
  }).optional()
});

export const MFAVerificationRequestSchema = z.object({
  token: z.string(),
  backupCode: z.string().optional()
});

export const PasswordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(256)
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email()
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(12).max(256)
});

export interface AuthResponse {
  success: boolean;
  user?: Partial<User>;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  mfaRequired?: boolean;
  mfaSessionToken?: string;
  errors?: string[];
}

export interface RegistrationResponse {
  success: boolean;
  user?: Partial<User>;
  verificationRequired?: boolean;
  errors?: string[];
}

export class AuthenticationService {
  private userRepository: Repository<User>;
  private roleRepository: Repository<Role>;
  private sessionRepository: Repository<Session>;
  private passwordHistoryRepository: Repository<PasswordHistory>;
  private passwordSecurity: PasswordSecurityService;
  private jwtService: JWTService;
  private auditService: AuditService;

  constructor(
    private dataSource: DataSource,
    private passwordSecurityService?: PasswordSecurityService,
    private jwtServiceInstance?: JWTService,
    private auditServiceInstance?: AuditService
  ) {
    this.userRepository = dataSource.getRepository(User);
    this.roleRepository = dataSource.getRepository(Role);
    this.sessionRepository = dataSource.getRepository(Session);
    this.passwordHistoryRepository = dataSource.getRepository(PasswordHistory);
    this.passwordSecurity = passwordSecurityService || new PasswordSecurityService();
    this.jwtService = jwtServiceInstance || new JWTService();
    this.auditService = auditServiceInstance || new AuditService(dataSource);
  }

  async register(userData: z.infer<typeof RegisterRequestSchema>): Promise<RegistrationResponse> {
    try {
      // Validate input
      const validated = RegisterRequestSchema.parse(userData);

      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: [
          { username: validated.username },
          { email: validated.email }
        ]
      });

      if (existingUser) {
        return {
          success: false,
          errors: existingUser.username === validated.username 
            ? ['Username already exists'] 
            : ['Email already registered']
        };
      }

      // Validate password
      const passwordValidation = this.passwordSecurity.validatePassword(
        validated.password,
        { username: validated.username, email: validated.email }
      );

      if (!passwordValidation.isValid) {
        return {
          success: false,
          errors: passwordValidation.errors
        };
      }

      // Hash password
      const { hash, salt } = await this.passwordSecurity.hashPassword(validated.password);

      // Get default user role
      let userRole = await this.roleRepository.findOne({ where: { name: 'user' } });
      if (!userRole) {
        userRole = await this.roleRepository.save({
          name: 'user',
          description: 'Default user role',
          permissions: ['read:own', 'write:own'],
          isActive: true
        });
      }

      // Create user
      const user = await this.userRepository.save({
        username: validated.username,
        email: validated.email,
        passwordHash: hash,
        passwordSalt: salt,
        firstName: validated.firstName,
        lastName: validated.lastName,
        phone: validated.phone,
        department: validated.department,
        jobTitle: validated.jobTitle,
        role: userRole,
        isActive: true,
        isEmailVerified: false,
        emailVerificationToken: crypto.randomBytes(32).toString('hex'),
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        loginAttempts: 0,
        lastLoginAt: null,
        passwordChangedAt: new Date()
      });

      // Add to password history
      await this.passwordHistoryRepository.save({
        user,
        passwordHash: hash,
        createdAt: new Date()
      });

      // Log registration
      await this.auditService.logEvent({
        userId: user.id,
        action: 'USER_REGISTERED',
        resource: 'auth',
        details: { username: user.username, email: user.email },
        ipAddress: 'system',
        userAgent: 'auth-service'
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified
        },
        verificationRequired: true
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        errors: ['Registration failed. Please try again.']
      };
    }
  }

  async login(loginData: z.infer<typeof LoginRequestSchema>): Promise<AuthResponse> {
    try {
      // Validate input
      const validated = LoginRequestSchema.parse(loginData);

      // Find user by username or email
      const user = await this.userRepository.findOne({
        where: [
          { username: validated.identifier },
          { email: validated.identifier }
        ],
        relations: ['role']
      });

      if (!user) {
        await this.auditService.logEvent({
          action: 'LOGIN_FAILED',
          resource: 'auth',
          details: { identifier: validated.identifier, reason: 'user_not_found' },
          ipAddress: validated.deviceInfo?.ip || 'unknown',
          userAgent: validated.deviceInfo?.userAgent || 'unknown'
        });
        return {
          success: false,
          errors: ['Invalid credentials']
        };
      }

      // Check if user is active
      if (!user.isActive) {
        await this.auditService.logEvent({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'auth',
          details: { reason: 'account_inactive' },
          ipAddress: validated.deviceInfo?.ip || 'unknown',
          userAgent: validated.deviceInfo?.userAgent || 'unknown'
        });
        return {
          success: false,
          errors: ['Account is inactive']
        };
      }

      // Check if account is locked
      if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
        await this.auditService.logEvent({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'auth',
          details: { reason: 'account_locked', lockedUntil: user.lockedUntil },
          ipAddress: validated.deviceInfo?.ip || 'unknown',
          userAgent: validated.deviceInfo?.userAgent || 'unknown'
        });
        return {
          success: false,
          errors: ['Account is temporarily locked']
        };
      }

      // Verify password
      const isPasswordValid = await this.passwordSecurity.verifyPassword(
        validated.password,
        user.passwordHash
      );

      if (!isPasswordValid) {
        // Increment login attempts
        const newAttempts = (user.loginAttempts || 0) + 1;
        const maxAttempts = 5;
        
        if (newAttempts >= maxAttempts) {
          // Lock account
          const lockDuration = 15 * 60 * 1000; // 15 minutes
          await this.userRepository.update(user.id, {
            loginAttempts: newAttempts,
            isLocked: true,
            lockedUntil: new Date(Date.now() + lockDuration)
          });

          await this.auditService.logEvent({
            userId: user.id,
            action: 'ACCOUNT_LOCKED',
            resource: 'auth',
            details: { attempts: newAttempts, lockDuration },
            ipAddress: validated.deviceInfo?.ip || 'unknown',
            userAgent: validated.deviceInfo?.userAgent || 'unknown'
          });

          return {
            success: false,
            errors: ['Account locked due to too many failed attempts']
          };
        } else {
          await this.userRepository.update(user.id, {
            loginAttempts: newAttempts
          });
        }

        await this.auditService.logEvent({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'auth',
          details: { reason: 'invalid_password', attempts: newAttempts },
          ipAddress: validated.deviceInfo?.ip || 'unknown',
          userAgent: validated.deviceInfo?.userAgent || 'unknown'
        });

        return {
          success: false,
          errors: ['Invalid credentials']
        };
      }

      // Check if MFA is required
      if (user.mfaEnabled) {
        const mfaSessionToken = crypto.randomBytes(32).toString('hex');
        
        // Store MFA session temporarily (could use Redis for production)
        await this.userRepository.update(user.id, {
          mfaSessionToken,
          mfaSessionExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        });

        return {
          success: true,
          mfaRequired: true,
          mfaSessionToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          }
        };
      }

      // Successful login - create session
      return this.createSuccessfulSession(user, validated);

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        errors: ['Login failed. Please try again.']
      };
    }
  }

  private async createSuccessfulSession(
    user: User,
    loginData: z.infer<typeof LoginRequestSchema>
  ): Promise<AuthResponse> {
    try {
      // Reset login attempts
      await this.userRepository.update(user.id, {
        loginAttempts: 0,
        isLocked: false,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: loginData.deviceInfo?.ip,
        lastLoginUserAgent: loginData.deviceInfo?.userAgent
      });

      // Generate tokens
      const tokens = await this.jwtService.generateTokenPair({
        userId: user.id,
        username: user.username,
        email: user.email,
        roleId: user.role?.id,
        permissions: user.role?.permissions || []
      });

      // Create session record
      const session = await this.sessionRepository.save({
        user,
        sessionToken: tokens.refreshToken,
        refreshToken: tokens.refreshToken,
        deviceInfo: loginData.deviceInfo?.userAgent,
        ipAddress: loginData.deviceInfo?.ip,
        platform: loginData.deviceInfo?.platform,
        browser: loginData.deviceInfo?.browser,
        isActive: true,
        expiresAt: new Date(Date.now() + (loginData.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000))
      });

      // Log successful login
      await this.auditService.logEvent({
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        resource: 'auth',
        details: { sessionId: session.id, rememberMe: loginData.rememberMe },
        ipAddress: loginData.deviceInfo?.ip || 'unknown',
        userAgent: loginData.deviceInfo?.userAgent || 'unknown'
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          mfaEnabled: user.mfaEnabled
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        }
      };

    } catch (error) {
      console.error('Session creation error:', error);
      return {
        success: false,
        errors: ['Failed to create session']
      };
    }
  }

  async verifyMFA(
    userId: string,
    mfaData: z.infer<typeof MFAVerificationRequestSchema>,
    mfaSessionToken: string,
    deviceInfo?: any
  ): Promise<AuthResponse> {
    try {
      // Validate input
      const validated = MFAVerificationRequestSchema.parse(mfaData);

      // Find user and validate MFA session
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role']
      });

      if (!user || 
          user.mfaSessionToken !== mfaSessionToken || 
          !user.mfaSessionExpires || 
          user.mfaSessionExpires < new Date()) {
        return {
          success: false,
          errors: ['Invalid or expired MFA session']
        };
      }

      // Verify TOTP token (this will be implemented with TOTP service)
      // For now, we'll simulate verification
      const isValidToken = await this.verifyTOTPToken(user, validated.token);
      const isValidBackupCode = validated.backupCode ? 
        await this.verifyBackupCode(user, validated.backupCode) : false;

      if (!isValidToken && !isValidBackupCode) {
        await this.auditService.logEvent({
          userId: user.id,
          action: 'MFA_FAILED',
          resource: 'auth',
          details: { reason: 'invalid_token' },
          ipAddress: deviceInfo?.ip || 'unknown',
          userAgent: deviceInfo?.userAgent || 'unknown'
        });
        return {
          success: false,
          errors: ['Invalid MFA token']
        };
      }

      // Clear MFA session
      await this.userRepository.update(user.id, {
        mfaSessionToken: null,
        mfaSessionExpires: null
      });

      // Create successful session
      const loginData = {
        identifier: user.username,
        password: '', // Already verified
        deviceInfo
      };

      return this.createSuccessfulSession(user, loginData);

    } catch (error) {
      console.error('MFA verification error:', error);
      return {
        success: false,
        errors: ['MFA verification failed']
      };
    }
  }

  private async verifyTOTPToken(user: User, token: string): Promise<boolean> {
    // This will be implemented with the TOTP service
    // For now, return false to indicate TOTP service is needed
    return false;
  }

  private async verifyBackupCode(user: User, backupCode: string): Promise<boolean> {
    // This will be implemented with the TOTP service
    // For now, return false to indicate TOTP service is needed
    return false;
  }

  async logout(userId: string, sessionToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find and invalidate session
      const session = await this.sessionRepository.findOne({
        where: { user: { id: userId }, sessionToken, isActive: true }
      });

      if (session) {
        await this.sessionRepository.update(session.id, {
          isActive: false,
          loggedOutAt: new Date()
        });
      }

      // Add token to blacklist
      await this.jwtService.blacklistToken(sessionToken);

      // Log logout
      await this.auditService.logEvent({
        userId,
        action: 'LOGOUT',
        resource: 'auth',
        details: { sessionId: session?.id },
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      return { success: true };

    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  async refreshToken(refreshToken: string): Promise<{ success: boolean; tokens?: any; error?: string }> {
    try {
      // Verify refresh token
      const payload = await this.jwtService.verifyRefreshToken(refreshToken);
      if (!payload) {
        return { success: false, error: 'Invalid refresh token' };
      }

      // Check if session is still active
      const session = await this.sessionRepository.findOne({
        where: { refreshToken, isActive: true },
        relations: ['user', 'user.role']
      });

      if (!session || session.expiresAt < new Date()) {
        return { success: false, error: 'Session expired' };
      }

      // Generate new token pair
      const tokens = await this.jwtService.generateTokenPair({
        userId: session.user.id,
        username: session.user.username,
        email: session.user.email,
        roleId: session.user.role?.id,
        permissions: session.user.role?.permissions || []
      });

      // Update session with new refresh token
      await this.sessionRepository.update(session.id, {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Log token refresh
      await this.auditService.logEvent({
        userId: session.user.id,
        action: 'TOKEN_REFRESH',
        resource: 'auth',
        details: { sessionId: session.id },
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      return { success: true, tokens };

    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false, error: 'Token refresh failed' };
    }
  }
}