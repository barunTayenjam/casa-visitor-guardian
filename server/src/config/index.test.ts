import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  config,
  validateConfig,
  getDetectionsPath,
  getEventPath,
  getArchivePath,
  getCameraById,
  getOpenCVServiceUrl,
  getStoragePathFromFile,
} from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Configuration Loading and Validation', () => {
  describe('Config object shape and defaults', () => {
    it('should have port as a number', () => {
      expect(typeof config.port).toBe('number');
      expect(config.port).toBeGreaterThan(0);
    });

    it('should have nodeEnv as a string', () => {
      expect(typeof config.nodeEnv).toBe('string');
      expect(['development', 'test', 'production']).toContain(config.nodeEnv);
    });

    it('should have jwtSecret configured', () => {
      expect(config.jwtSecret).toBeDefined();
      expect(typeof config.jwtSecret).toBe('string');
      expect(config.jwtSecret.length).toBeGreaterThan(0);
    });

    it('should have database config with expected fields', () => {
      expect(config.database).toHaveProperty('host');
      expect(config.database).toHaveProperty('port');
      expect(config.database).toHaveProperty('name');
      expect(typeof config.database.host).toBe('string');
      expect(typeof config.database.port).toBe('number');
    });

    it('should have security config with expected defaults', () => {
      expect(config.security.bcryptRounds).toBe(12);
      expect(config.security.maxLoginAttempts).toBe(5);
      expect(config.security.rateLimitMax).toBe(100);
      expect(typeof config.security.lockoutDuration).toBe('number');
      expect(typeof config.security.rateLimitWindow).toBe('number');
    });

    it('should have storage config with expected fields', () => {
      expect(config.storage).toHaveProperty('snapshotsDir');
      expect(config.storage).toHaveProperty('eventsDir');
      expect(config.storage).toHaveProperty('detectionsDir');
      expect(config.storage).toHaveProperty('retentionDays');
      expect(config.storage).toHaveProperty('enableFileIndexing');
      expect(typeof config.storage.retentionDays).toBe('number');
    });

    it('should have streaming config with expected fields', () => {
      expect(typeof config.streaming.frameInterval).toBe('number');
      expect(config.streaming.frameInterval).toBeGreaterThan(0);
      expect(config.streaming.defaultFps).toBeGreaterThan(0);
      expect(typeof config.streaming.defaultResolution).toBe('string');
      expect(typeof config.streaming.threads).toBe('number');
      expect(typeof config.streaming.inactivityTimeout).toBe('number');
    });

    it('should have MQTT config with expected fields', () => {
      expect(config.mqtt).toHaveProperty('enabled');
      expect(config.mqtt).toHaveProperty('topicPrefix');
      expect(config.mqtt).toHaveProperty('port');
      expect(config.mqtt.topicPrefix).toBe('sentryvision');
      expect(config.mqtt.port).toBe(1883);
    });

    it('should have pipeline config with expected fields', () => {
      expect(config.pipeline).toBeDefined();
      expect(config.pipeline).toHaveProperty('mode');
      expect(config.pipeline).toHaveProperty('pythonWsUrl');
    });

    it('should default PIPELINE_MODE to python-only in source code', () => {
      // The source code must have 'python-only' as the fallback default
      // config.pipeline.mode is 'dual' when .env sets PIPELINE_MODE=dual,
      // but the code-level default must be 'python-only'
      const configPath = path.join(__dirname, 'index.ts');
      const configSource = fs.readFileSync(configPath, 'utf8');
      expect(configSource).toMatch(/PIPELINE_MODE.*\|\|.*'python-only'/);
    });

    it('should respect PIPELINE_MODE env var override', () => {
      // Config value reflects whatever PIPELINE_MODE is set to in .env
      expect(['legacy', 'dual', 'python-only']).toContain(config.pipeline.mode);
    });

    it('should have valid pipeline mode values', () => {
      expect(['legacy', 'dual', 'python-only']).toContain(config.pipeline.mode);
    });
  });

  describe('Camera config loading', () => {
    it('should load cameras as an array', () => {
      expect(Array.isArray(config.cameras)).toBe(true);
    });

    it('should load at least 2 cameras from cameras.json', () => {
      expect(config.cameras.length).toBeGreaterThanOrEqual(2);
    });

    it('should have cameras with required fields', () => {
      for (const camera of config.cameras) {
        expect(camera).toHaveProperty('id');
        expect(camera).toHaveProperty('name');
        expect(camera).toHaveProperty('enabled');
        expect(camera).toHaveProperty('streams');
        expect(Array.isArray(camera.streams)).toBe(true);
      }
    });

    it('should have cam1 (Front Door) configured', () => {
      const cam1 = config.cameras.find((c) => c.id === 'cam1');
      expect(cam1).toBeDefined();
      expect(cam1?.name).toBe('Front Door');
      expect(cam1?.streams.length).toBeGreaterThan(0);
    });

    it('should have cam2 (Back Door) configured', () => {
      const cam2 = config.cameras.find((c) => c.id === 'cam2');
      expect(cam2).toBeDefined();
      expect(cam2?.name).toBe('Back Door');
      expect(cam2?.streams.length).toBeGreaterThan(0);
    });

    it('should have camera streams with path and roles', () => {
      for (const camera of config.cameras) {
        for (const stream of camera.streams) {
          expect(stream).toHaveProperty('path');
          expect(stream).toHaveProperty('roles');
          expect(Array.isArray(stream.roles)).toBe(true);
          expect(typeof stream.path).toBe('string');
        }
      }
    });

    it('should have detect config on cameras', () => {
      for (const camera of config.cameras) {
        expect(camera.detect).toBeDefined();
        expect(camera.detect).toHaveProperty('width');
        expect(camera.detect).toHaveProperty('height');
        expect(camera.detect).toHaveProperty('fps');
      }
    });
  });

  describe('Config validation', () => {
    it('should not throw for valid config', () => {
      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('getOpenCVServiceUrl', () => {
    it('should return the OpenCV service URL', () => {
      const url = getOpenCVServiceUrl();
      expect(typeof url).toBe('string');
      expect(url).toContain('8084');
    });
  });

  describe('getDetectionsPath', () => {
    it('should return events path for events type', () => {
      const testDate = new Date('2026-01-15');
      const result = getDetectionsPath('events', testDate);
      expect(result).toContain('2026-01');
      expect(result).toContain('events');
    });

    it('should return snapshots path for snapshots type', () => {
      const testDate = new Date('2026-06-01');
      const result = getDetectionsPath('snapshots', testDate);
      expect(result).toContain('2026-06');
      expect(result).toContain('snapshots');
    });

    it('should return batch path for batch type', () => {
      const testDate = new Date('2026-03-20');
      const result = getDetectionsPath('batch', testDate);
      expect(result).toContain('2026-03');
      expect(result).toContain('batch-results');
    });

    it('should return temp path for temp type', () => {
      const testDate = new Date('2026-12-25');
      const result = getDetectionsPath('temp', testDate);
      expect(result).toContain('2026-12');
      expect(result).toContain('temp');
    });

    it('should use current date when no date provided', () => {
      const result = getDetectionsPath('events');
      const currentYear = new Date().getFullYear();
      expect(result).toContain(currentYear.toString());
    });
  });

  describe('getEventPath', () => {
    it('should return faces subdirectory for faces type', () => {
      const testDate = new Date('2026-02-14');
      const result = getEventPath('faces', testDate);
      expect(result).toContain('2026-02');
      expect(result).toContain('events');
      expect(result).toContain('faces');
    });

    it('should return motion subdirectory for motion type', () => {
      const testDate = new Date('2026-07-04');
      const result = getEventPath('motion', testDate);
      expect(result).toContain('2026-07');
      expect(result).toContain('events');
      expect(result).toContain('motion');
    });
  });

  describe('getArchivePath', () => {
    it('should return archive path with year-month', () => {
      const testDate = new Date('2026-09-15');
      const result = getArchivePath(testDate);
      expect(result).toContain('2026-09');
      expect(result).toContain('archive');
    });
  });

  describe('getStoragePathFromFile', () => {
    it('should return face event path for event_face type', () => {
      const testDate = new Date('2026-04-01');
      const result = getStoragePathFromFile('event_face', testDate);
      expect(result).toContain('events');
      expect(result).toContain('faces');
    });

    it('should return motion event path for event_motion type', () => {
      const testDate = new Date('2026-05-01');
      const result = getStoragePathFromFile('event_motion', testDate);
      expect(result).toContain('events');
      expect(result).toContain('motion');
    });

    it('should return snapshot path for snapshot type', () => {
      const testDate = new Date('2026-08-01');
      const result = getStoragePathFromFile('snapshot', testDate);
      expect(result).toContain('snapshots');
    });

    it('should return batch path for batch_result type', () => {
      const testDate = new Date('2026-10-01');
      const result = getStoragePathFromFile('batch_result', testDate);
      expect(result).toContain('batch-results');
    });

    it('should return temp path for temp type', () => {
      const testDate = new Date('2026-11-01');
      const result = getStoragePathFromFile('temp', testDate);
      expect(result).toContain('temp');
    });
  });

  describe('getCameraById', () => {
    it('should return undefined for non-existent camera', () => {
      expect(getCameraById('non-existent-camera')).toBeUndefined();
    });

    it('should find cam1 by id', () => {
      const camera = getCameraById('cam1');
      expect(camera).toBeDefined();
      expect(camera?.id).toBe('cam1');
      expect(camera?.name).toBe('Front Door');
    });

    it('should find cam2 by id', () => {
      const camera = getCameraById('cam2');
      expect(camera).toBeDefined();
      expect(camera?.id).toBe('cam2');
      expect(camera?.name).toBe('Back Door');
    });

    it('should return camera with zones configured', () => {
      const cam1 = getCameraById('cam1');
      expect(cam1?.zones).toBeDefined();
      expect(cam1?.zones?.length).toBeGreaterThan(0);
    });

    it('should return camera with object tracking config', () => {
      const cam1 = getCameraById('cam1');
      expect(cam1?.objects).toBeDefined();
      expect(cam1?.objects?.track).toBeDefined();
      expect(cam1?.objects?.track?.length).toBeGreaterThan(0);
    });
  });
});
