import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '9753', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'sentryvision',
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD
  },
  cameras: JSON.parse(process.env.CAMERAS || '[]'),
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10), // 15 minutes
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },
  storage: {
    snapshotsDir: process.env.SNAPSHOTS_DIR || path.join(__dirname, '../public/snapshots'),
    eventsDir: process.env.EVENTS_DIR || path.join(__dirname, '../public/events')
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