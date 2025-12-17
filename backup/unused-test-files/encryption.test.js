import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EncryptionManager } from '../utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('EncryptionManager', () => {
  const testKeyFile = path.join(__dirname, '../../.test_encryption_key');

  beforeEach(() => {
    // Clean up any existing test key
    if (fs.existsSync(testKeyFile)) {
      fs.unlinkSync(testKeyFile);
    }
    
    // Mock the key file path for testing
    const originalGetKey = EncryptionManager.getEncryptionKey;
    EncryptionManager.getEncryptionKey = () => {
      return Buffer.from('12345678901234567890123456789012', 'hex'); // 32 bytes
    };
  });

  afterEach(() => {
    // Clean up test key
    if (fs.existsSync(testKeyFile)) {
      fs.unlinkSync(testKeyFile);
    }
  });

  it('should encrypt and decrypt text correctly', () => {
    const plaintext = 'test-password-123';
    const encrypted = EncryptionManager.encrypt(plaintext);
    const decrypted = EncryptionManager.decrypt(encrypted);
    
    expect(encrypted).not.toBe(plaintext);
    expect(decrypted).toBe(plaintext);
  });

  it('should generate different encrypted values for same input', () => {
    const plaintext = 'test-password';
    const encrypted1 = EncryptionManager.encrypt(plaintext);
    const encrypted2 = EncryptionManager.encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2);
    
    const decrypted1 = EncryptionManager.decrypt(encrypted1);
    const decrypted2 = EncryptionManager.decrypt(encrypted2);
    
    expect(decrypted1).toBe(plaintext);
    expect(decrypted2).toBe(plaintext);
  });

  it('should hash and verify passwords correctly', () => {
    const password = 'user-password-123';
    const { hash, salt } = EncryptionManager.hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash).not.toBe(password);
    
    const isValid = EncryptionManager.verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);
    
    const isInvalid = EncryptionManager.verifyPassword('wrong-password', hash, salt);
    expect(isInvalid).toBe(false);
  });

  it('should generate secure tokens', () => {
    const token1 = EncryptionManager.generateSecureToken();
    const token2 = EncryptionManager.generateSecureToken();
    
    expect(token1).toHaveLength(64); // 32 bytes * 2 (hex)
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });
});