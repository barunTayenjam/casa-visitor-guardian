import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CredentialManager } from '../utils/credentialManager.js';

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
    maxStorageGB: number;
    retentionDays: number;
  };
  streaming: {
    frameInterval: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
}

// Default configuration
const defaultConfig: Partial<AppConfig> = {
  port: parseInt(process.env.PORT || '9753', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'home_security',
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10), // 15 minutes
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  storage: {
    snapshotsDir: process.env.SNAPSHOTS_DIR || path.join(__dirname, '../../public/snapshots'),
    eventsDir: process.env.EVENTS_DIR || path.join(__dirname, '../../public/events'),
    maxStorageGB: parseInt(process.env.MAX_STORAGE_GB || '10', 10),
    retentionDays: parseInt(process.env.RETENTION_DAYS || '30', 10),
  },
  streaming: {
    frameInterval: parseInt(process.env.FRAME_INTERVAL || '40', 10), // ~25 FPS
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5', 10),
    reconnectDelay: parseInt(process.env.RECONNECT_DELAY || '5000', 10), // 5 seconds
  },
};

// Load camera configuration from environment or file
function loadCameraConfig(): CameraConfig[] {
  // Try to load from cameras.json file first
  const camerasFile = path.join(__dirname, '../../cameras.json');
  if (fs.existsSync(camerasFile)) {
    try {
      const camerasData = fs.readFileSync(camerasFile, 'utf8');
      const cameras = JSON.parse(camerasData);
      
      // Enrich cameras with credentials from secure storage
      return cameras.map((camera: CameraConfig) => {
        if (camera.credentialId) {
          const credential = CredentialManager.getCredential(camera.credentialId);
          if (credential) {
            return {
              ...camera,
              username: credential.username,
              password: credential.password
            };
          }
        }
        return camera;
      });
    } catch (error) {
      console.warn('Failed to load cameras.json, using environment variables:', error);
    }
  }

  // Load from environment variables
  const camerasEnv = process.env.CAMERAS_CONFIG;
  if (camerasEnv) {
    try {
      return JSON.parse(camerasEnv);
    } catch (error) {
      console.warn('Failed to parse CAMERAS_CONFIG environment variable:', error);
    }
  }

  // Fallback to demo cameras for development
  if (process.env.NODE_ENV !== 'production') {
    return [
      {
        id: 'demo-cam-1',
        name: 'Demo Camera 1',
        rtspUrl: 'rtsp://demo.example.com/stream1',
        username: 'demo',
        password: 'demo',
        frameRate: 15,
        resolution: '1920x1080',
        nightMode: false,
      },
    ];
  }

  return [];
}

// Create and export the configuration
export const config: AppConfig = {
  ...defaultConfig,
  cameras: loadCameraConfig(),
} as AppConfig;

// Validate required configuration
export function validateConfig(): void {
  const requiredEnvVars = ['JWT_SECRET'];
  
  if (config.nodeEnv === 'production') {
    requiredEnvVars.push('DB_HOST', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD');
  }

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  if (config.cameras.length === 0 && config.nodeEnv === 'production') {
    throw new Error('No cameras configured. Please set up cameras.json or CAMERAS_CONFIG environment variable.');
  }
}

// Export configuration helper functions
export const getCameraById = (id: string): CameraConfig | undefined => {
  return config.cameras.find(camera => camera.id === id);
};

export const getCamerasByStatus = (): CameraConfig[] => {
  // This would need to be implemented with actual camera status tracking
  return config.cameras;
};

export default config;