import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // bytes
const IV_LENGTH = 16; // bytes
const SALT_LENGTH = 32; // bytes
const TAG_LENGTH = 16; // bytes
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedCredential {
  encrypted: string; // base64 encoded ciphertext
  iv: string; // base64 encoded initialization vector
  tag: string; // base64 encoded auth tag
  version: 1; // for future algorithm updates
}

let encryptionKey: Buffer | null = null;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
}

function getEncryptionKey(): Buffer {
  if (encryptionKey) {
    return encryptionKey;
  }

  const credentialKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (!credentialKey) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
  }

  if (credentialKey.length < 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be at least 32 characters');
  }

  encryptionKey = Buffer.from(credentialKey.slice(0, KEY_LENGTH), 'utf-8');
  return encryptionKey;
}

export function encryptCredential(plaintext: string): EncryptedCredential {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      version: 1
    };
  } catch (error) {
    logger.error('Failed to encrypt credential', 'CredentialEncryption', error);
    throw new Error('Credential encryption failed');
  }
}

export function decryptCredential(encrypted: EncryptedCredential): string {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, 'base64');
    const tag = Buffer.from(encrypted.tag, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Failed to decrypt credential', 'CredentialEncryption', error);
    throw new Error('Credential decryption failed');
  }
}

export function isEncryptedCredential(value: unknown): value is EncryptedCredential {
  return (
    typeof value === 'object' &&
    value !== null &&
    'encrypted' in value &&
    'iv' in value &&
    'tag' in value &&
    'version' in value &&
    typeof (value as EncryptedCredential).encrypted === 'string' &&
    typeof (value as EncryptedCredential).iv === 'string' &&
    typeof (value as EncryptedCredential).tag === 'string'
  );
}

export function validateEncryptionKey(): boolean {
  try {
    getEncryptionKey();

    const testPlaintext = 'test-credential-validation';
    const encrypted = encryptCredential(testPlaintext);
    const decrypted = decryptCredential(encrypted);

    return decrypted === testPlaintext;
  } catch (error) {
    logger.error('Encryption key validation failed', 'CredentialEncryption', error);
    return false;
  }
}
