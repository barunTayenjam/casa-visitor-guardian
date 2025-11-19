import { AuthenticationService } from '../../server/src/services/authenticationService';
import { PasswordSecurityService } from '../../server/src/utils/passwordSecurity';
import { JWTService } from '../../server/src/utils/jwtService';
import { AuditService } from '../../server/src/utils/auditService';
import { UserFactory, MockDataGenerator, TestHelpers } from '../utils/factories';

// Mock dependencies
jest.mock('../../server/src/utils/passwordSecurity');
jest.mock('../../server/src/utils/jwtService');
jest.mock('../../server/src/utils/auditService');

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockPasswordSecurity: jest.Mocked<PasswordSecurityService>;
  let mockJWTService: jest.Mocked<JWTService>;
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    mockPasswordSecurity = new PasswordSecurityService() as jest.Mocked<PasswordSecurityService>;
    mockJWTService = new JWTService() as jest.Mocked<JWTService>;
    mockAuditService = new AuditService({} as any) as jest.Mocked<AuditService>;

    authService = new AuthenticationService(
      {} as any, // dataSource
      mockPasswordSecurity,
      mockJWTService,
      mockAuditService
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user with valid data', async () => {
      const userData = MockDataGenerator.generateValidUserData();
      
      mockPasswordSecurity.validatePassword.mockReturnValue({
        isValid: true,
        errors: []
      });

      mockPasswordSecurity.hashPassword.mockResolvedValue({
        hash: 'hashed-password',
        salt: 'random-salt'
      });

      mockAuditService.logEvent.mockResolvedValue({} as any);

      const result = await authService.register(userData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe(userData.username);
      expect(result.user?.email).toBe(userData.email);
      expect(result.verificationRequired).toBe(true);
      
      expect(mockPasswordSecurity.validatePassword).toHaveBeenCalledWith(
        userData.password,
        { username: userData.username, email: userData.email }
      );
      
      expect(mockPasswordSecurity.hashPassword).toHaveBeenCalledWith(userData.password);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_REGISTERED',
          resource: 'auth'
        })
      );
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        ...MockDataGenerator.generateValidUserData(),
        email: 'invalid-email'
      };

      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        ...MockDataGenerator.generateValidUserData(),
        password: 'weak'
      };

      mockPasswordSecurity.validatePassword.mockReturnValue({
        isValid: false,
        errors: ['Password is too weak']
      });

      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Password is too weak');
    });

    it('should reject registration with existing email', async () => {
      const userData = MockDataGenerator.generateValidUserData();
      
      // Mock existing user check
      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({
            id: 'existing-user-id',
            email: userData.email
          })
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Email already registered');
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginData = MockDataGenerator.generateLoginData();
      
      // Mock user lookup
      const mockUser = UserFactory.create({
        email: loginData.identifier,
        passwordHash: 'hashed-password',
        status: 'active',
        failedLoginAttempts: 0
      });

      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(mockUser),
          save: jest.fn().mockResolvedValue({} as any)
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      mockPasswordSecurity.verifyPassword.mockResolvedValue(true);
      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900
      } as any);

      const result = await authService.login(loginData);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user?.email).toBe(loginData.identifier);
      
      expect(mockPasswordSecurity.verifyPassword).toHaveBeenCalledWith(
        loginData.password,
        'hashed-password'
      );
      
      expect(mockJWTService.generateTokenPair).toHaveBeenCalled();
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_SUCCESS',
          resource: 'auth'
        })
      );
    });

    it('should reject login with invalid credentials', async () => {
      const loginData = MockDataGenerator.generateLoginData();
      loginData.password = 'wrong-password';

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid credentials');
      
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          resource: 'auth'
        })
      );
    });

    it('should reject login for inactive account', async () => {
      const loginData = MockDataGenerator.generateLoginData();
      
      const mockUser = UserFactory.create({
        email: loginData.identifier,
        status: 'inactive'
      });

      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(mockUser)
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Account is not active');
    });

    it('should lock account after 5 failed attempts', async () => {
      const loginData = MockDataGenerator.generateLoginData();
      
      const mockUser = UserFactory.create({
        email: loginData.identifier,
        failedLoginAttempts: 4
      });

      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(mockUser),
          save: jest.fn().mockResolvedValue({} as any)
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      mockPasswordSecurity.verifyPassword.mockResolvedValue(false);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Account locked due to too many failed attempts');
      
      // Verify account was locked
      expect(mockDataSource.getRepository().save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 5,
          status: 'locked'
        })
      );
    });

    it('should require MFA when enabled', async () => {
      const loginData = MockDataGenerator.generateLoginData();
      
      const mockUser = UserFactory.create({
        email: loginData.identifier,
        mfaEnabled: true
      });

      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(mockUser)
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      mockPasswordSecurity.verifyPassword.mockResolvedValue(true);

      const result = await authService.login(loginData);

      expect(result.success).toBe(true);
      expect(result.mfaRequired).toBe(true);
      expect(result.mfaSessionToken).toBeDefined();
      expect(result.accessToken).toBeUndefined();
    });
  });

  describe('verifyMFA', () => {
    it('should verify valid TOTP token', async () => {
      const userId = 'user-id';
      const mfaData = { token: '123456' };
      const mfaSessionToken = 'valid-session-token';

      const result = await authService.verifyMFA(userId, mfaData, mfaSessionToken);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MFA_VERIFIED',
          resource: 'auth'
        })
      );
    });

    it('should reject invalid TOTP token', async () => {
      const userId = 'user-id';
      const mfaData = { token: 'invalid-token' };
      const mfaSessionToken = 'valid-session-token';

      const result = await authService.verifyMFA(userId, mfaData, mfaSessionToken);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid MFA token');
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const userId = 'user-id';
      const sessionToken = 'valid-session-token';

      const result = await authService.logout(userId, sessionToken);

      expect(result.success).toBe(true);
      
      expect(mockJWTService.blacklistToken).toHaveBeenCalledWith(sessionToken);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          resource: 'auth'
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh valid token', async () => {
      const refreshToken = 'valid-refresh-token';
      
      const mockSession = {
        userId: 'user-id',
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000)
      };

      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(mockSession),
          save: jest.fn().mockResolvedValue({} as any)
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      mockJWTService.verifyRefreshToken.mockResolvedValue({ userId: 'user-id' });
      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900
      } as any);

      const result = await authService.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      expect(result.tokens?.accessToken).toBe('new-access-token');
      
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TOKEN_REFRESH',
          resource: 'auth'
        })
      );
    });

    it('should reject invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockJWTService.verifyRefreshToken.mockResolvedValue(null);

      const result = await authService.refreshToken(refreshToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid refresh token');
    });
  });

  describe('password change', () => {
    it('should successfully change password with valid current password', async () => {
      const userId = 'user-id';
      const passwordChangeData = {
        currentPassword: 'old-password',
        newPassword: 'NewSecurePass123!@#'
      };

      const mockUser = UserFactory.create({
        passwordHash: 'old-hashed-password'
      });

      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(mockUser),
          save: jest.fn().mockResolvedValue({} as any)
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      mockPasswordSecurity.verifyPassword.mockResolvedValue(true);
      mockPasswordSecurity.hashPassword.mockResolvedValue({
        hash: 'new-hashed-password',
        salt: 'new-salt'
      });

      const result = await authService.changePassword(userId, passwordChangeData);

      expect(result.success).toBe(true);
      
      expect(mockPasswordSecurity.verifyPassword).toHaveBeenCalledWith(
        'old-password',
        'old-hashed-password'
      );
      
      expect(mockPasswordSecurity.hashPassword).toHaveBeenCalledWith('NewSecurePass123!@#');
      
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGED',
          resource: 'auth'
        })
      );
    });

    it('should reject password change with invalid current password', async () => {
      const userId = 'user-id';
      const passwordChangeData = {
        currentPassword: 'wrong-password',
        newPassword: 'NewSecurePass123!@#'
      };

      mockPasswordSecurity.verifyPassword.mockResolvedValue(false);

      const result = await authService.changePassword(userId, passwordChangeData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Current password is incorrect');
    });
  });

  describe('edge cases', () => {
    it('should handle database errors gracefully', async () => {
      const userData = MockDataGenerator.generateValidUserData();
      
      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockRejectedValue(new Error('Database connection failed'))
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Registration failed');
    });

    it('should handle concurrent login attempts', async () => {
      const loginData = MockDataGenerator.generateLoginData();
      
      const mockUser = UserFactory.create({
        email: loginData.identifier,
        failedLoginAttempts: 3
      });

      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(mockUser),
          save: jest.fn().mockResolvedValue({} as any)
        })
      } as any;

      authService = new AuthenticationService(
        mockDataSource,
        mockPasswordSecurity,
        mockJWTService,
        mockAuditService
      );

      mockPasswordSecurity.verifyPassword.mockResolvedValue(false);

      // Simulate concurrent login attempts
      const promises = Array.from({ length: 3 }, () => 
        authService.login(loginData)
      );

      const results = await Promise.all(promises);

      // All should fail with invalid credentials
      results.forEach(result => {
        expect(result.success).toBe(false);
      });
      
      // Final attempt should lock the account
      const finalResult = await authService.login(loginData);
      expect(finalResult.errors).toContain('Account locked');
    });
  });
});