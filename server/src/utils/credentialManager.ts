import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EncryptionManager } from './encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SecureCredential {
  id: string;
  type: 'camera' | 'database' | 'email' | 'api';
  name: string;
  username?: string;
  password?: string;
  apiKey?: string;
  additionalData?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastRotated?: Date;
}

export interface EncryptedCredentialStore {
  version: string;
  credentials: Array<{
    id: string;
    type: string;
    name: string;
    encryptedData: string;
    createdAt: string;
    updatedAt: string;
    lastRotated?: string;
  }>;
}

export class CredentialManager {
  private static readonly STORE_FILE = path.join(__dirname, '../../.credentials.enc');
  private static readonly VERSION = '1.0';

  private static loadStore(): EncryptedCredentialStore {
    if (!fs.existsSync(CredentialManager.STORE_FILE)) {
      return {
        version: CredentialManager.VERSION,
        credentials: []
      };
    }

    try {
      const encryptedData = fs.readFileSync(CredentialManager.STORE_FILE, 'utf8');
      const decryptedData = EncryptionManager.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Failed to load credential store:', error);
      return {
        version: CredentialManager.VERSION,
        credentials: []
      };
    }
  }

  private static saveStore(store: EncryptedCredentialStore): void {
    const data = JSON.stringify(store, null, 2);
    const encryptedData = EncryptionManager.encrypt(data);
    fs.writeFileSync(CredentialManager.STORE_FILE, encryptedData, { mode: 0o600 });
  }

  static addCredential(credential: Omit<SecureCredential, 'createdAt' | 'updatedAt'>): void {
    const store = this.loadStore();
    
    const secureCredential: SecureCredential = {
      ...credential,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const encryptedData = EncryptionManager.encrypt(JSON.stringify({
      username: secureCredential.username,
      password: secureCredential.password,
      apiKey: secureCredential.apiKey,
      additionalData: secureCredential.additionalData
    }));

    store.credentials.push({
      id: secureCredential.id,
      type: secureCredential.type,
      name: secureCredential.name,
      encryptedData,
      createdAt: secureCredential.createdAt.toISOString(),
      updatedAt: secureCredential.updatedAt.toISOString(),
      lastRotated: secureCredential.lastRotated?.toISOString()
    });

    this.saveStore(store);
  }

  static getCredential(id: string): SecureCredential | null {
    const store = this.loadStore();
    const encryptedCred = store.credentials.find(c => c.id === id);
    
    if (!encryptedCred) {
      return null;
    }

    try {
      const decryptedData = JSON.parse(EncryptionManager.decrypt(encryptedCred.encryptedData));
      
      return {
        id: encryptedCred.id,
        type: encryptedCred.type as any,
        name: encryptedCred.name,
        username: decryptedData.username,
        password: decryptedData.password,
        apiKey: decryptedData.apiKey,
        additionalData: decryptedData.additionalData,
        createdAt: new Date(encryptedCred.createdAt),
        updatedAt: new Date(encryptedCred.updatedAt),
        lastRotated: encryptedCred.lastRotated ? new Date(encryptedCred.lastRotated) : undefined
      };
    } catch (error) {
      console.error(`Failed to decrypt credential ${id}:`, error);
      return null;
    }
  }

  static getCredentialsByType(type: SecureCredential['type']): SecureCredential[] {
    const store = this.loadStore();
    return store.credentials
      .filter(c => c.type === type)
      .map(encryptedCred => {
        try {
          const decryptedData = JSON.parse(EncryptionManager.decrypt(encryptedCred.encryptedData));
          return {
            id: encryptedCred.id,
            type: encryptedCred.type as any,
            name: encryptedCred.name,
            username: decryptedData.username,
            password: decryptedData.password,
            apiKey: decryptedData.apiKey,
            additionalData: decryptedData.additionalData,
            createdAt: new Date(encryptedCred.createdAt),
            updatedAt: new Date(encryptedCred.updatedAt),
            lastRotated: encryptedCred.lastRotated ? new Date(encryptedCred.lastRotated) : undefined
          };
        } catch (error) {
          console.error(`Failed to decrypt credential ${encryptedCred.id}:`, error);
          return null;
        }
      })
      .filter(Boolean) as SecureCredential[];
  }

  static updateCredential(id: string, updates: Partial<SecureCredential>): boolean {
    const store = this.loadStore();
    const credIndex = store.credentials.findIndex(c => c.id === id);
    
    if (credIndex === -1) {
      return false;
    }

    const existingCred = store.credentials[credIndex];
    const currentData = JSON.parse(EncryptionManager.decrypt(existingCred.encryptedData));

    const updatedData = {
      ...currentData,
      ...(updates.username && { username: updates.username }),
      ...(updates.password && { password: updates.password }),
      ...(updates.apiKey && { apiKey: updates.apiKey }),
      ...(updates.additionalData && { additionalData: updates.additionalData })
    };

    const newEncryptedData = EncryptionManager.encrypt(JSON.stringify(updatedData));

    store.credentials[credIndex] = {
      ...existingCred,
      ...(updates.name && { name: updates.name }),
      ...(updates.type && { type: updates.type }),
      encryptedData: newEncryptedData,
      updatedAt: new Date().toISOString(),
      ...(updates.lastRotated && { lastRotated: updates.lastRotated.toISOString() })
    };

    this.saveStore(store);
    return true;
  }

  static deleteCredential(id: string): boolean {
    const store = this.loadStore();
    const initialLength = store.credentials.length;
    store.credentials = store.credentials.filter(c => c.id !== id);
    
    if (store.credentials.length < initialLength) {
      this.saveStore(store);
      return true;
    }
    
    return false;
  }

  static rotateCredential(id: string, newPassword?: string): boolean {
    const credential = this.getCredential(id);
    if (!credential) {
      return false;
    }

    const updates: Partial<SecureCredential> = {
      lastRotated: new Date()
    };

    if (newPassword && credential.type === 'camera') {
      updates.password = newPassword;
    }

    return this.updateCredential(id, updates);
  }

  static validateCredentials(): boolean {
    try {
      const store = this.loadStore();
      return store.version === this.VERSION;
    } catch (error) {
      console.error('Credential store validation failed:', error);
      return false;
    }
  }

  static migrateFromCamerasJson(): void {
    const camerasFile = path.join(__dirname, '../../cameras.json');
    if (!fs.existsSync(camerasFile)) {
      return;
    }

    try {
      const camerasData = JSON.parse(fs.readFileSync(camerasFile, 'utf8'));
      
      for (const camera of camerasData) {
        if (camera.username && camera.password) {
          this.addCredential({
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

      // Backup original file and create new one without credentials
      const backupFile = path.join(__dirname, '../../cameras.json.backup');
      fs.copyFileSync(camerasFile, backupFile);
      
      // Create new cameras.json without credentials
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
      
      console.log('Successfully migrated camera credentials to secure storage');
    } catch (error) {
      console.error('Failed to migrate credentials from cameras.json:', error);
    }
  }
}