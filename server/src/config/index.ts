import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

export interface CameraConfig {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  frameRate: number;
  resolution: string;
  nightMode: boolean;
  credentialId?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  username?: string;
  password?: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  database: DatabaseConfig;
  cameras: CameraConfig[];
  security: {
    bcryptRounds: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  storage: {
    snapshotsDir: string;
    eventsDir: string;
    detectionsDir: string;
    retentionDays: number;
    archivePath: string;
    enableFileIndexing: boolean;
    fileIndexOnSave: boolean;
  };
  streaming: {
    frameInterval: number;
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '9753', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'sentryvision',
    username: process.env.DB_USER || process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD
  },
  cameras: (() => {
    try {
      // Try environment variable first
      if (process.env.CAMERAS) {
        return JSON.parse(process.env.CAMERAS);
      }
      // Fallback to cameras.json file
      const camerasPath = path.join(__dirname, '../../cameras.json');
      if (fs.existsSync(camerasPath)) {
        const camerasData = fs.readFileSync(camerasPath, 'utf8');
        return JSON.parse(camerasData);
      }
      return [];
    } catch (error) {
      console.error('Failed to load camera configuration:', error);
      return [];
    }
  })(),
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10), // 15 minutes
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },
  storage: {
    snapshotsDir: process.env.SNAPSHOTS_DIR || path.join(process.cwd(), '../public/snapshots'),
    eventsDir: process.env.EVENTS_DIR || path.join(process.cwd(), '../public/events'),
    detectionsDir: process.env.DETECTIONS_DIR || path.join(process.cwd(), '../data/detections'),
    retentionDays: parseInt(process.env.DETECTIONS_RETENTION_DAYS || '30', 10),
    archivePath: process.env.DETECTIONS_ARCHIVE_PATH || path.join(process.cwd(), '../data/detections/archive'),
    enableFileIndexing: process.env.ENABLE_FILE_INDEXING === 'true',
    fileIndexOnSave: process.env.FILE_INDEX_ON_SAVE === 'true'
  },
  streaming: {
    frameInterval: parseInt(process.env.FRAME_INTERVAL || '1000', 10) // 1 second default
  }
};

export const getCameraById = (id: string): CameraConfig | undefined => {
  return config.cameras.find(camera => camera.id === id);
};

export const getDetectionsPath = (type: 'events' | 'snapshots' | 'batch' | 'temp', date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;

  if (type === 'events') {
    return path.join(config.storage.detectionsDir, yearMonth, 'events');
  } else if (type === 'snapshots') {
    return path.join(config.storage.detectionsDir, yearMonth, 'snapshots');
  } else if (type === 'batch') {
    return path.join(config.storage.detectionsDir, yearMonth, 'batch-results');
  } else {
    return path.join(config.storage.detectionsDir, yearMonth, 'temp');
  }
};

export const getEventPath = (subType: 'faces' | 'motion', date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  return path.join(config.storage.detectionsDir, yearMonth, 'events', subType);
};

export const getArchivePath = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}-${month}`;
  return path.join(config.storage.archivePath, yearMonth);
};

export const getStoragePathFromFile = (fileType: 'event_face' | 'event_motion' | 'snapshot' | 'batch_result' | 'temp', date: Date = new Date()): string => {
  if (fileType === 'event_face') {
    return getEventPath('faces', date);
  } else if (fileType === 'event_motion') {
    return getEventPath('motion', date);
  } else if (fileType === 'snapshot') {
    return getDetectionsPath('snapshots', date);
  } else if (fileType === 'batch_result') {
    return getDetectionsPath('batch', date);
  } else {
    return getDetectionsPath('temp', date);
  }
};

export const validateConfig = (): void => {
  if (!config.jwtSecret || config.jwtSecret === 'fallback-secret-change-in-production') {
    if (config.nodeEnv === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    } else {
      console.warn('Using fallback JWT secret. Set JWT_SECRET in production.');
    }
  }
};