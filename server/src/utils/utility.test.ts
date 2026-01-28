import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Utility Functions', () => {
  describe('Encryption', () => {
    it('should encrypt and decrypt text', () => {
      const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
      
      const plaintext = 'test-password';
      const encrypted = EncryptionManager.encrypt(plaintext);
      const decrypted = EncryptionManager.decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should generate secure tokens', () => {
      const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
      
      const token1 = EncryptionManager.generateSecureToken();
      const token2 = EncryptionManager.generateSecureToken();

      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('should hash and verify passwords', () => {
      const EncryptionManager = require('../utils/encryption.js').EncryptionManager;
      
      const password = 'test-password-123';
      const { hash, salt } = EncryptionManager.hashPassword(password);
      const isValid = EncryptionManager.verifyPassword(password, hash, salt);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash).not.toBe(password);
      expect(isValid).toBe(true);
    });
  });

  describe('File Operations', () => {
    it('should calculate file hash', () => {
      const { fileHash } = require('../utils/fileHash.js');
      
      const content = 'test content';
      const hash = fileHash(content);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });
  });
});
