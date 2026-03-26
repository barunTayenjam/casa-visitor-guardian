#!/usr/bin/env node

/**
 * Credential Migration Script
 *
 * This script encrypts all RTSP credentials in server/cameras.json
 * Usage:
 *   node dist/scripts/migrateCredentials.js --dry-run  # Test without making changes
 *   node dist/scripts/migrateCredentials.js            # Run migration
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptCredential, isEncryptedCredential, validateEncryptionKey } from '../services/credentialEncryption.js';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../config/database.js';
import { SecurityEvent, SecurityEventType } from '../models/SecurityEvent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CameraStreamConfig {
  path: string;
  roles: string[];
  width?: number;
  height?: number;
  fps?: number;
}

interface CameraConfig {
  id: string;
  name: string;
  enabled: boolean;
  streams: CameraStreamConfig[];
  [key: string]: unknown;
}

interface CamerasConfig {
  cameras: CameraConfig[];
}

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run')
  };
}

function getCamerasFilePath(): string {
  return path.join(__dirname, '../../cameras.json');
}

function getBackupFilePath(originalPath: string): string {
  return `${originalPath}.backup`;
}

function loadCamerasConfig(filePath: string): CameraConfig[] {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data) as CameraConfig[];
}

function saveCamerasConfig(filePath: string, cameras: CameraConfig[]): void {
  fs.writeFileSync(filePath, JSON.stringify(cameras, null, 4), 'utf8');
}

function isStreamEncrypted(path: unknown): path is { encrypted: string; iv: string; tag: string; version: number } {
  return isEncryptedCredential(path);
}

function encryptCameraStream(camera: CameraConfig, streamIndex: number): { encrypted: boolean; original: string } {
  const stream = camera.streams[streamIndex];

  if (isStreamEncrypted(stream.path)) {
    logger.info(`Camera ${camera.id} stream ${streamIndex} already encrypted`, 'CredentialMigration');
    return { encrypted: false, original: '[ALREADY ENCRYPTED]' };
  }

  if (typeof stream.path !== 'string') {
    logger.warn(`Camera ${camera.id} stream ${streamIndex} has invalid path type`, 'CredentialMigration');
    return { encrypted: false, original: '[INVALID TYPE]' };
  }

  const original = stream.path;
  const encrypted = encryptCredential(stream.path);
  stream.path = encrypted as unknown as string;

  return { encrypted: true, original };
}

async function logSecurityEvent(eventType: SecurityEventType, details: Record<string, unknown>): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const securityEventRepo = AppDataSource.getRepository(SecurityEvent);
    const event = securityEventRepo.create({
      eventType,
      details
    });
    await securityEventRepo.save(event);
  } catch (error) {
    logger.error('Failed to log security event', 'CredentialMigration', error);
  }
}

async function migrateCredentials(dryRun: boolean): Promise<void> {
  try {
    logger.info(`Starting credential migration (dry-run: ${dryRun})`, 'CredentialMigration');

    const camerasPath = getCamerasFilePath();

    if (!fs.existsSync(camerasPath)) {
      throw new Error(`Cameras configuration file not found: ${camerasPath}`);
    }

    const cameras = loadCamerasConfig(camerasPath);

    let totalStreams = 0;
    let encryptedCount = 0;
    let skippedCount = 0;

    for (const camera of cameras) {
      if (!camera.streams || !Array.isArray(camera.streams)) {
        logger.warn(`Camera ${camera.id} has no streams array`, 'CredentialMigration');
        continue;
      }

      for (let i = 0; i < camera.streams.length; i++) {
        totalStreams++;
        const result = encryptCameraStream(camera, i);

        if (result.encrypted) {
          encryptedCount++;
          logger.info(`Encrypted RTSP URL for ${camera.name} (stream ${i})`, 'CredentialMigration');
        } else {
          skippedCount++;
        }
      }
    }

    if (dryRun) {
      logger.info(`Dry run complete. Would encrypt ${encryptedCount} of ${totalStreams} streams`, 'CredentialMigration');
      return;
    }

    const backupPath = getBackupFilePath(camerasPath);
    fs.copyFileSync(camerasPath, backupPath);
    logger.info(`Created backup at ${backupPath}`, 'CredentialMigration');

    saveCamerasConfig(camerasPath, cameras);
    logger.info(`Saved encrypted configuration to ${camerasPath}`, 'CredentialMigration');

    await logSecurityEvent(SecurityEventType.PLAINTEXT_CREDENTIALS_DETECTED, {
      totalStreams,
      encryptedCount,
      skippedCount,
      timestamp: new Date().toISOString()
    });

    logger.info(`Migration complete: ${encryptedCount} encrypted, ${skippedCount} skipped, ${totalStreams} total`, 'CredentialMigration');
  } catch (error) {
    logger.error('Migration failed', 'CredentialMigration', error);
    await logSecurityEvent(SecurityEventType.CREDENTIAL_DECRYPTION_FAILED, {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    const { dryRun } = parseArgs();

    if (!validateEncryptionKey()) {
      throw new Error('Encryption key validation failed. Please check CREDENTIAL_ENCRYPTION_KEY environment variable.');
    }

    await migrateCredentials(dryRun);

    process.exit(0);
  } catch (error) {
    logger.error('Fatal error during migration', 'CredentialMigration', error);
    process.exit(1);
  }
}

main();
