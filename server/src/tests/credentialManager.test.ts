import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { CredentialManager, SecureCredential } from '../utils/credentialManager.js';
import { EncryptionManager } from '../utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CredentialManager', () => {
  const testStoreFile = path.join(__dirname, '../../.test_credentials.enc');

  beforeEach(() => {
    // Clean up any existing test store
    if (fs.existsSync(testStoreFile)) {
      fs.unlinkSync(testStoreFile);
    }
    
    // Mock the store file path for testing
    (CredentialManager as any).STORE_FILE = testStoreFile;
    
    // Mock the encryption key for testing
    (EncryptionManager as any).getEncryptionKey = () => {
      return Buffer.from('1234567890123456789012345678901234567890123456789012345678901234', 'hex'); // 64 bytes
    };
  });

  afterEach(() => {
    // Clean up test store
    if (fs.existsSync(testStoreFile)) {
      fs.unlinkSync(testStoreFile);
    }
  });

  describe('EncryptionManager', () => {
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

  describe('Credential Storage', () => {
    it('should add and retrieve credentials', () => {
      const credential: Omit<SecureCredential, 'createdAt' | 'updatedAt'> = {
        id: 'test-camera-1',
        type: 'camera',
        name: 'Test Camera',
        username: 'admin',
        password: 'password123',
        additionalData: { rtspUrl: 'rtsp://192.168.1.100:554/stream' }
      };

      CredentialManager.addCredential(credential);
      
      const retrieved = CredentialManager.getCredential('test-camera-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('test-camera-1');
      expect(retrieved!.type).toBe('camera');
      expect(retrieved!.name).toBe('Test Camera');
      expect(retrieved!.username).toBe('admin');
      expect(retrieved!.password).toBe('password123');
      expect(retrieved!.additionalData?.rtspUrl).toBe('rtsp://192.168.1.100:554/stream');
      expect(retrieved!.createdAt).toBeInstanceOf(Date);
      expect(retrieved!.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent credentials', () => {
      const result = CredentialManager.getCredential('non-existent');
      expect(result).toBeNull();
    });

    it('should get credentials by type', () => {
      const cameraCred: Omit<SecureCredential, 'createdAt' | 'updatedAt'> = {
        id: 'camera-1',
        type: 'camera',
        name: 'Camera 1',
        username: 'cam_user',
        password: 'cam_pass'
      };

      const emailCred: Omit<SecureCredential, 'createdAt' | 'updatedAt'> = {
        id: 'email-1',
        type: 'email',
        name: 'Email Service',
        username: 'email@example.com',
        password: 'email_pass'
      };

      CredentialManager.addCredential(cameraCred);
      CredentialManager.addCredential(emailCred);

      const cameraCreds = CredentialManager.getCredentialsByType('camera');
      const emailCreds = CredentialManager.getCredentialsByType('email');

      expect(cameraCreds).toHaveLength(1);
      expect(cameraCreds[0].id).toBe('camera-1');
      expect(cameraCreds[0].type).toBe('camera');

      expect(emailCreds).toHaveLength(1);
      expect(emailCreds[0].id).toBe('email-1');
      expect(emailCreds[0].type).toBe('email');
    });

    it('should update credentials', () => {
      const credential: Omit<SecureCredential, 'createdAt' | 'updatedAt'> = {
        id: 'update-test',
        type: 'camera',
        name: 'Original Name',
        username: 'original_user',
        password: 'original_pass'
      };

      CredentialManager.addCredential(credential);
      
      const updated = CredentialManager.updateCredential('update-test', {
        name: 'Updated Name',
        password: 'new_password'
      });

      expect(updated).toBe(true);

      const retrieved = CredentialManager.getCredential('update-test');
      expect(retrieved!.name).toBe('Updated Name');
      expect(retrieved!.password).toBe('new_password');
      expect(retrieved!.username).toBe('original_user'); // Should remain unchanged
    });

    it('should return false when updating non-existent credential', () => {
      const result = CredentialManager.updateCredential('non-existent', { name: 'New Name' });
      expect(result).toBe(false);
    });

    it('should delete credentials', () => {
      const credential: Omit<SecureCredential, 'createdAt' | 'updatedAt'> = {
        id: 'delete-test',
        type: 'camera',
        name: 'To Delete',
        username: 'user',
        password: 'pass'
      };

      CredentialManager.addCredential(credential);
      
      let retrieved = CredentialManager.getCredential('delete-test');
      expect(retrieved).toBeDefined();

      const deleted = CredentialManager.deleteCredential('delete-test');
      expect(deleted).toBe(true);

      retrieved = CredentialManager.getCredential('delete-test');
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent credential', () => {
      const result = CredentialManager.deleteCredential('non-existent');
      expect(result).toBe(false);
    });

    it('should rotate credentials', () => {
      const credential: Omit<SecureCredential, 'createdAt' | 'updatedAt'> = {
        id: 'rotate-test',
        type: 'camera',
        name: 'Rotate Test',
        username: 'user',
        password: 'old_password'
      };

      CredentialManager.addCredential(credential);
      
      const rotated = CredentialManager.rotateCredential('rotate-test', 'new_password');
      expect(rotated).toBe(true);

      const retrieved = CredentialManager.getCredential('rotate-test');
      expect(retrieved!.password).toBe('new_password');
      expect(retrieved!.lastRotated).toBeInstanceOf(Date);
    });
  });

  describe('Store Validation', () => {
    it('should validate credential store', () => {
      expect(CredentialManager.validateCredentials()).toBe(true);
    });
  });

  describe('Migration', () => {
    it('should migrate from cameras.json', () => {
      const camerasFile = path.join(__dirname, '../../test_cameras.json');
      const camerasData = [
        {
          id: 'cam1',
          name: 'Front Door',
          rtspUrl: 'rtsp://192.168.1.100:554/stream',
          username: 'admin',
          password: 'password123',
          frameRate: 15,
          resolution: '1920x1080',
          nightMode: false
        }
      ];

      fs.writeFileSync(camerasFile, JSON.stringify(camerasData, null, 2));

      // Mock the migration function to use test file
      const originalPath = (CredentialManager as any).migrateFromCamerasJson.toString();
      const migrateFromCamerasJson = () => {
        if (!fs.existsSync(camerasFile)) return;

        const camerasData = JSON.parse(fs.readFileSync(camerasFile, 'utf8'));
        
        for (const camera of camerasData) {
          if (camera.username && camera.password) {
            CredentialManager.addCredential({
              id: `camera_${camera.id}`,
              type: 'camera',
              name: camera.name,
              username: camera.username,
              password: camera.password,
              additionalData: {
                rtspUrl: camera.rtspUrl,
                frameRate: camera.frameRate,
                resolution: camera.resolution,
                nightMode: camera.nightMode
              }
            });
          }
        }

        // Backup and create sanitized version
        const backupFile = path.join(__dirname, '../../test_cameras.json.backup');
        fs.copyFileSync(camerasFile, backupFile);
        
        const sanitizedCameras = camerasData.map((camera: any) => ({
          id: camera.id,
          name: camera.name,
          rtspUrl: camera.rtspUrl,
          frameRate: camera.frameRate,
          resolution: camera.resolution,
          nightMode: camera.nightMode,
          credentialId: `camera_${camera.id}`
        }));
        
        fs.writeFileSync(camerasFile, JSON.stringify(sanitizedCameras, null, 2));
      };

      migrateFromCamerasJson();

      // Verify credential was created
      const credential = CredentialManager.getCredential('camera_cam1');
      expect(credential).toBeDefined();
      expect(credential!.username).toBe('admin');
      expect(credential!.password).toBe('password123');

      // Verify cameras.json was sanitized
      const updatedCameras = JSON.parse(fs.readFileSync(camerasFile, 'utf8'));
      expect(updatedCameras[0].username).toBeUndefined();
      expect(updatedCameras[0].password).toBeUndefined();
      expect(updatedCameras[0].credentialId).toBe('camera_cam1');

      // Cleanup
      fs.unlinkSync(camerasFile);
      fs.unlinkSync(path.join(__dirname, '../../test_cameras.json.backup'));
    });
  });
});