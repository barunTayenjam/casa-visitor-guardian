import * as faker from '@faker-js/faker';
import * as crypto from 'crypto';

// Simplified interfaces for testing
interface TestUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  roleId?: string;
  status: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
  failedLoginAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  role?: {
    id: string;
    name: string;
    permissions: string[];
  };
}

interface TestSession {
  id: string;
  userId: string;
  refreshToken: string;
  accessTokenHash: string;
  deviceInfo: any;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastAccessed: Date;
}

interface TestAuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: string;
  metadata: any;
  timestamp: Date;
}

interface TestRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TestPasswordHistory {
  id: string;
  userId: string;
  passwordHash: string;
  createdAt: Date;
}

export class UserFactory {
  static create(overrides: Partial<TestUser> = {}): Partial<TestUser> {
    return {
      id: faker.datatype.uuid(),
      username: faker.internet.userName(),
      email: faker.internet.email(),
      passwordHash: crypto.randomBytes(32).toString('hex'),
      salt: crypto.randomBytes(16).toString('hex'),
      status: 'active',
      mfaEnabled: false,
      emailVerified: true,
      failedLoginAttempts: 0,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<TestUser> = {}): Partial<TestUser>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createWithRole(roleName: string, overrides: Partial<TestUser> = {}): Partial<TestUser> {
    return this.create({
      ...overrides,
      role: {
        id: faker.datatype.uuid(),
        name: roleName,
        permissions: this.getPermissionsForRole(roleName)
      }
    });
  }

  private static getPermissionsForRole(roleName: string): string[] {
    const rolePermissions = {
      admin: ['user:read', 'user:write', 'user:delete', 'system:admin'],
      operator: ['camera:read', 'camera:write', 'event:read', 'event:write'],
      viewer: ['camera:read', 'event:read']
    };
    
    return rolePermissions[roleName as keyof typeof rolePermissions] || [];
  }
}

export class SessionFactory {
  static create(overrides: Partial<TestSession> = {}): Partial<TestSession> {
    const now = new Date();
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      refreshToken: crypto.randomBytes(32).toString('hex'),
      accessTokenHash: crypto.randomBytes(32).toString('hex'),
      deviceInfo: {
        browser: 'Chrome',
        os: 'Windows',
        device: 'Desktop'
      },
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      isActive: true,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      createdAt: faker.date.past(),
      lastAccessed: now,
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<TestSession> = {}): Partial<TestSession>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

export class AuditLogFactory {
  static create(overrides: Partial<TestAuditLog> = {}): Partial<TestAuditLog> {
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      action: faker.helpers.arrayElement([
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'USER_CREATED',
        'USER_UPDATED',
        'PASSWORD_CHANGED',
        'MFA_ENABLED',
        'LOGOUT',
        'SESSION_CREATED',
        'TOKEN_REFRESH'
      ]),
      resourceType: faker.helpers.arrayElement(['USER', 'SESSION', 'MFA', 'SYSTEM', 'AUTH']),
      resourceId: faker.datatype.uuid(),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      severity: faker.helpers.arrayElement(['debug', 'info', 'warning', 'error', 'critical']),
      metadata: {},
      timestamp: faker.date.recent(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<TestAuditLog> = {}): Partial<TestAuditLog>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

export class RoleFactory {
  static create(overrides: Partial<TestRole> = {}): Partial<TestRole> {
    return {
      id: faker.datatype.uuid(),
      name: faker.helpers.arrayElement(['admin', 'operator', 'viewer']),
      description: faker.lorem.sentence(),
      permissions: faker.helpers.arrayElement([
        ['user:read', 'user:write'],
        ['camera:read', 'camera:write'],
        ['system:admin']
      ]),
      isSystemRole: false,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<TestRole> = {}): Partial<TestRole>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

export class PasswordHistoryFactory {
  static create(overrides: Partial<TestPasswordHistory> = {}): Partial<TestPasswordHistory> {
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      passwordHash: crypto.randomBytes(32).toString('hex'),
      createdAt: faker.date.past(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<TestPasswordHistory> = {}): Partial<TestPasswordHistory>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// Mock data generators
export class MockDataGenerator {
  static generateValidUserData() {
    return {
      username: faker.internet.userName().toLowerCase(),
      email: faker.internet.email(),
      password: 'SecurePass123!@#',
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      phone: faker.phone.number(),
      department: faker.commerce.department(),
      jobTitle: faker.name.jobTitle()
    };
  }

  static generateInvalidUserData() {
    return {
      username: 'ab', // Too short
      email: 'invalid-email',
      password: '123', // Too weak
      firstName: '',
      lastName: '',
      phone: '',
      department: '',
      jobTitle: ''
    };
  }

  static generateLoginData() {
    return {
      identifier: faker.internet.email(),
      password: 'SecurePass123!@#',
      rememberMe: faker.datatype.boolean(),
      deviceInfo: {
        userAgent: faker.internet.userAgent(),
        ip: faker.internet.ip(),
        platform: faker.helpers.arrayElement(['Windows', 'macOS', 'Linux']),
        browser: faker.helpers.arrayElement(['Chrome', 'Firefox', 'Safari'])
      }
    };
  }

  static generateTOTPData() {
    return {
      userId: faker.datatype.uuid(),
      issuer: 'SentryVision',
      accountName: faker.internet.email(),
      algorithm: 'sha256' as const,
      digits: 6,
      period: 30
    };
  }

  static generateAuditEventData() {
    return {
      userId: faker.datatype.uuid(),
      action: faker.helpers.arrayElement([
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'USER_CREATED',
        'PASSWORD_CHANGED'
      ]),
      resource: faker.helpers.arrayElement(['auth', 'user', 'session']),
      resourceId: faker.datatype.uuid(),
      details: {
        ip: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        timestamp: new Date().toISOString()
      },
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      severity: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
      category: faker.helpers.arrayElement([
        'authentication', 'authorization', 'data_access', 
        'data_modification', 'system', 'security'
      ])
    };
  }
}

// Test helpers
export class TestHelpers {
  static async waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateTestToken(): string {
    return 'test-token-' + this.generateRandomString(16);
  }

  static createMockRequest(overrides: any = {}) {
    return {
      headers: {
        'user-agent': faker.internet.userAgent(),
        'x-forwarded-for': faker.internet.ip()
      },
      ip: faker.internet.ip(),
      ...overrides
    };
  }

  static createMockResponse() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  }
}