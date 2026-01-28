import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

export function getOpenCVServiceUrl(): string {
  return process.env.OPENCV_SERVICE_URL || 'http://opencv:8084';
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
        fps: camera.frameRate || 15
      }
    ],
    detect: {
      width: 640,
      height: 360,
      fps: 5,
      minInitialized: 2,
      maxDisappeared: 25
    },
    record: {
      enabled: true,
      retainDays: 30,
      mode: 'active_objects',
      alerts: {
        preCapture: 5,
        postCapture: 5,
        retainDays: 14
      }
    },
    objects: {
      track: ['person', 'car', 'dog', 'cat'],
      filters: {
        person: {
          minArea: 5000,
          maxArea: 100000,
          threshold: 0.7
        },
        car: {
          minArea: 10000,
          maxArea: 200000,
          threshold: 0.7
        }
      }
    },
    nightMode: camera.nightMode || false,
    credentialId: camera.credentialId
  };
}

export interface CameraStreamConfig {
  path: string;
  roles: ('detect' | 'record' | 'live')[];
  width?: number;
  height?: number;
  fps?: number;
}

export interface ZoneConfig {
  id: string;
  name: string;
  coordinates: number[][]; // Polygon coordinates as [x, y] normalized 0-1
  objects?: string[]; // Objects that can trigger this zone
  inertia?: number; // Consecutive frames required
  loiteringTime?: number; // Seconds before considered in zone
}

export interface ObjectFilterConfig {
  minArea?: number;
  maxArea?: number;
  minRatio?: number;
  maxRatio?: number;
  minScore?: number;
  threshold?: number;
  mask?: string;
}

export interface DetectConfig {
  width: number;
  height: number;
  fps: number;
  minInitialized?: number;
  maxDisappeared?: number;
}

export interface RecordConfig {
  enabled: boolean;
  retainDays?: number;
  mode?: 'all' | 'motion' | 'active_objects';
  alerts?: {
    preCapture?: number;
    postCapture?: number;
    retainDays?: number;
  };
}

export interface LiveConfig {
  fps?: number;
}

export interface CameraConfig {
  id: string;
  name: string;
  enabled: boolean;
  streams: CameraStreamConfig[];
  detect: DetectConfig;
  live?: LiveConfig;
  record?: RecordConfig;
  zones?: ZoneConfig[];
  objects?: {
    track?: string[];
    filters?: Record<string, ObjectFilterConfig>;
  };
  motion?: {
    enabled?: boolean;
    threshold?: number;
    contourArea?: number;
    mask?: string;
  };
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

export interface MQTTConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  topicPrefix?: string;
  user?: string;
  password?: string;
  qos?: 0 | 1 | 2;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  database: DatabaseConfig;
  mqtt: MQTTConfig;
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
    host: process.env.DB_HOST || '172.26.0.3',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'sentryvision',
    username: process.env.DB_USER || process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD
  },
  mqtt: {
    enabled: process.env.MQTT_ENABLED === 'true',
    host: process.env.MQTT_HOST,
    port: parseInt(process.env.MQTT_PORT || '1883', 10),
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'sentryvision',
    user: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
    qos: parseInt(process.env.MQTT_QOS || '0', 10) as 0 | 1 | 2
  },
  cameras: (() => {
    try {
      if (process.env.CAMERAS) {
        const parsed = JSON.parse(process.env.CAMERAS);
        return parsed.map((camera: any) => {
          if (camera.streams && Array.isArray(camera.streams)) {
            return camera; // New format
          }
          return convertLegacyCameraConfig(camera); // Legacy format
        });
      }
      const camerasPath = path.join(__dirname, '../../cameras.json');
      if (fs.existsSync(camerasPath)) {
        const camerasData = fs.readFileSync(camerasPath, 'utf8');
        const parsed = JSON.parse(camerasData);
        return parsed.map((camera: any) => {
          if (camera.streams && Array.isArray(camera.streams)) {
            return camera; // New format
          }
          return convertLegacyCameraConfig(camera); // Legacy format
        });
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