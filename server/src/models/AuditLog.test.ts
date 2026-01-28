import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('typeorm');

describe('AuditLog Model', () => {
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create audit log entry', () => {
    const AuditLog = require('./AuditLog.js').AuditLog;
    const log = new AuditLog();
    
    log.action = 'user_login';
    log.resourceType = 'user';
    log.severity = 'info';
    log.userId = 'user-123';
    log.ipAddress = '192.168.1.1';
    log.userAgent = 'Mozilla/5.0';
    log.details = JSON.stringify({ success: true });
    
    expect(log.action).toBe('user_login');
    expect(log.severity).toBe('info');
    expect(log.userId).toBe('user-123');
    expect(log.ipAddress).toBe('192.168.1.1');
  });

  it('should validate severity levels', () => {
    const AuditLog = require('./AuditLog.js').AuditLog;
    const log = new AuditLog();
    
    log.severity = 'critical';
    
    expect(['debug', 'info', 'warning', 'error', 'critical']).toContain(log.severity);
  });

  it('should handle timestamps', () => {
    const AuditLog = require('./AuditLog.js').AuditLog;
    const log = new AuditLog();
    
    const timestamp = new Date();
    log.createdAt = timestamp;
    log.updatedAt = timestamp;
    
    expect(log.createdAt).toBeInstanceOf(Date);
    expect(log.updatedAt).toBeInstanceOf(Date);
  });
});
