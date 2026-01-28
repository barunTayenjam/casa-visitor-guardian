import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('fs');

describe('CredentialManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should add credential', () => {
    const { CredentialManager } = require('../utils/credentialManager.js');
    
    const credential = {
      id: 'test-1',
      type: 'camera',
      name: 'Test Camera',
      username: 'admin',
      password: 'password123',
      additionalData: { rtspUrl: 'rtsp://192.168.1.100:554/stream' }
    };

    // Mock successful add
    const result = CredentialManager.addCredential(credential);
    
    expect(result).toBe(true);
  });

  it('should retrieve credential by id', () => {
    const { CredentialManager } = require('../utils/credentialManager.js');
    const testCredential = {
      id: 'test-1',
      type: 'test',
      name: 'Test',
      username: 'user',
      password: 'pass',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = CredentialManager.getCredential('test-1');
    
    expect(result).toBeDefined();
    expect(result?.id).toBe('test-1');
    expect(result?.username).toBe('user');
  });

  it('should get credentials by type', () => {
    const { CredentialManager } = require('../utils/credentialManager.js');
    const camCred = {
      id: 'cam-1',
      type: 'camera',
      name: 'Camera',
      username: 'camuser'
    };
    const emailCred = {
      id: 'email-1',
      type: 'email',
      name: 'Email',
      username: 'emailuser'
    };

    // Mock to return credentials by type
    const getByType = CredentialManager.getCredentialsByType as jest.Mock;
    getByType.mockReturnValue({
      camera: [camCred],
      email: [emailCred]
    });

    const cameraCreds = CredentialManager.getCredentialsByType('camera');
    
    expect(cameraCreds).toHaveLength(1);
    expect(cameraCreds[0]?.type).toBe('camera');
  });

  it('should update credential', () => {
    const { CredentialManager } = require('../utils/credentialManager.js');
    
    const updated = CredentialManager.updateCredential('test-1', {
      name: 'Updated Name'
    });
    
    expect(updated).toBe(true);
  });

  it('should delete credential', () => {
    const { CredentialManager } = require('../utils/credentialManager.js');
    
    const deleted = CredentialManager.deleteCredential('test-1');
    
    expect(deleted).toBe(true);
  });
});
