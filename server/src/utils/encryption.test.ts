import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Encryption Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should encrypt text', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const plaintext = 'test-password-123';
    const encrypted = EncryptionManager.encrypt(plaintext);
    
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });

  it('should decrypt encrypted text', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const plaintext = 'test-password-123';
    const encrypted = EncryptionManager.encrypt(plaintext);
    const decrypted = EncryptionManager.decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt/decrypt cycle correctly', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const original = 'original message';
    const encrypted = EncryptionManager.encrypt(original);
    const decrypted = EncryptionManager.decrypt(encrypted);
    
    expect(decrypted).toBe(original);
  });

  it('should generate different encrypted values for same input', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const plaintext = 'same input';
    const encrypted1 = EncryptionManager.encrypt(plaintext);
    const encrypted2 = EncryptionManager.encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should generate secure tokens', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const token1 = EncryptionManager.generateSecureToken();
    const token2 = EncryptionManager.generateSecureToken();
    
    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('should hash passwords', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const password = 'user-password-123';
    const { hash, salt } = EncryptionManager.hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash).not.toBe(password);
    expect(salt).not.toBe(password);
  });

  it('should verify passwords correctly', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const password = 'user-password-123';
    const { hash, salt } = EncryptionManager.hashPassword(password);
    const isValid = EncryptionManager.verifyPassword(password, hash, salt);
    
    expect(isValid).toBe(true);
  });

  it('should reject incorrect passwords', () => {
    const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
    
    const password = 'user-password-123';
    const { hash, salt } = EncryptionManager.hashPassword(password);
    const isWrong = !EncryptionManager.verifyPassword('wrong-password', hash, salt);
    
    expect(isWrong).toBe(true);
  });
});
