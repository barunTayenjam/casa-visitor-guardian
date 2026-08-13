import { describe, it, expect, jest } from '@jest/globals';
import { User } from './User.js';

jest.mock('../models/Role.js');

describe('User Model', () => {
  let mockAppDataSource: any;

  beforeEach(() => {
    mockAppDataSource = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User entity properties', () => {
    it('should have required fields', () => {
      const user = new User();
      user.username = 'testuser';
      user.email = 'test@example.com';
      user.passwordHash = 'hashedpassword123';
      user.salt = 'salt123';
      
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBe('hashedpassword123');
      expect(user.salt).toBe('salt123');
    });

    it('should allow assigning status and flags', () => {
      const user = new User();

      user.status = 'active';
      user.mfaEnabled = false;
      user.failedLoginAttempts = 0;

      expect(user.status).toBe('active');
      expect(user.mfaEnabled).toBe(false);
      expect(user.failedLoginAttempts).toBe(0);
    });

    it('should allow assigning role relationship', () => {
      const user = new User();
      const role = { id: 'role-1', name: 'admin' };
      user.role = role as any;

      expect(user.role).toBeDefined();
      expect(user.role).toBe(role);
    });

    it('should allow assigning session relationship', () => {
      const user = new User();
      user.sessions = [];

      expect(user.sessions).toBeDefined();
      expect(user.sessions).toBeInstanceOf(Array);
    });

    it('should allow assigning audit log relationship', () => {
      const user = new User();
      user.auditLogs = [];

      expect(user.auditLogs).toBeDefined();
      expect(user.auditLogs).toBeInstanceOf(Array);
    });

    it('should allow assigning password history relationship', () => {
      const user = new User();
      user.passwordHistory = [];

      expect(user.passwordHistory).toBeDefined();
      expect(user.passwordHistory).toBeInstanceOf(Array);
    });
  });

  describe('User entity serialization', () => {
    it('should serialize to JSON correctly', () => {
      const user = new User();
      user.id = 'test-uuid';
      user.username = 'testuser';
      user.email = 'test@example.com';
      
      const json = JSON.parse(JSON.stringify(user));
      
      expect(json.id).toBe('test-uuid');
      expect(json.username).toBe('testuser');
      expect(json.email).toBe('test@example.com');
      expect(json.passwordHash).toBeUndefined();
      expect(json.salt).toBeUndefined();
    });
  });
});
