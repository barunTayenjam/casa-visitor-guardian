import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';
import { decryptCredential, isEncryptedCredential } from '../services/credentialEncryption.js';
import { config, type CameraConfig } from './index.js';
import { AppDataSource } from '../database.js';
import { SecurityEvent } from '../models/SecurityEvent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function logSecurityEventDeferred(
  eventType: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      logger.warn(`Security event (database not ready): ${eventType}`, 'Config', details);
      return;
    }
    const securityEventRepo = AppDataSource.getRepository(SecurityEvent);
    const event = securityEventRepo.create({
      eventType: eventType as any,
      details,
    });
    await securityEventRepo.save(event);
  } catch (error) {
    logger.error('Failed to log security event', 'Config', error);
  }
}

function decryptStreamPath(streamPath: string | any): string {
  if (isEncryptedCredential(streamPath)) {
    try {
      const decrypted = decryptCredential(streamPath);
      logger.debug('Successfully decrypted RTSP credential', 'Config');
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt credential, logging security event', 'Config', error);
      logSecurityEventDeferred('CREDENTIAL_DECRYPTION_FAILED', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }).catch((err: unknown) => {
        logger.error('Deferred security log (decryption failed) failed', 'Config', err);
      });
      throw error;
    }
  } else {
    logger.warn('Detected plaintext RTSP credential in configuration', 'Config');
    logSecurityEventDeferred('PLAINTEXT_CREDENTIALS_DETECTED', {
      timestamp: new Date().toISOString(),
    }).catch((err: unknown) => {
      logger.error('Deferred security log (plaintext) failed', 'Config', err);
    });
    return streamPath;
  }
}

function convertLegacyCameraConfig(camera: any): CameraConfig {
  return {
    id: camera.id,
    name: camera.name,
    enabled: true,
    streams: [
      {
        path: camera.rtspUrl,
        roles: ['detect', 'record', 'live'],
        width: parseInt(camera.resolution?.split('x')[0]) || 1920,
        height: parseInt(camera.resolution?.split('x')[1]) || 1080,
        fps: camera.frameRate || 15,
      },
    ],
    detect: {
      width: 640,
      height: 360,
      fps: 5,
      minInitialized: 2,
      maxDisappeared: 25,
    },
    record: {
      enabled: true,
      retainDays: 30,
      mode: 'active_objects',
      alerts: {
        preCapture: 5,
        postCapture: 5,
        retainDays: 14,
      },
    },
    objects: {
      track: ['person', 'car', 'dog', 'cat'],
      filters: {
        person: {
          minArea: 5000,
          maxArea: 100000,
          threshold: 0.7,
        },
        car: {
          minArea: 10000,
          maxArea: 200000,
          threshold: 0.7,
        },
      },
    },
    nightMode: camera.nightMode || false,
    credentialId: camera.credentialId,
  };
}

export function setCameras(cameras: CameraConfig[]): void {
  config.cameras = cameras;
}

export function loadCamerasFromFile(): CameraConfig[] {
  try {
    if (process.env.CAMERAS) {
      const parsed = JSON.parse(process.env.CAMERAS);
      return parsed
        .map((camera: any) => {
          if (camera.streams && Array.isArray(camera.streams)) return camera;
          return convertLegacyCameraConfig(camera);
        })
        .map((camera: any) => ({
          ...camera,
          streams: camera.streams.map((stream: any) => ({
            ...stream,
            path: decryptStreamPath(stream.path),
          })),
        }));
    }
    const camerasPath = path.join(__dirname, '../../cameras.json');
    if (fs.existsSync(camerasPath)) {
      const camerasData = fs.readFileSync(camerasPath, 'utf8');
      const parsed = JSON.parse(camerasData);
      return parsed
        .map((camera: any) => {
          if (camera.streams && Array.isArray(camera.streams)) return camera;
          return convertLegacyCameraConfig(camera);
        })
        .map((camera: any) => ({
          ...camera,
          streams: camera.streams.map((stream: any) => ({
            ...stream,
            path: decryptStreamPath(stream.path),
          })),
        }));
    }
    return [];
  } catch (error) {
    logger.warn(
      'Failed to load cameras from file (non-critical, DB is primary source)',
      'Config',
      error,
    );
    return [];
  }
}
