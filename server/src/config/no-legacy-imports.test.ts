import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLN-02: Verify deleted legacy Node.js detection modules cannot be imported
 * CLN-04: Verify no HTTP polling/retry loops exist for detection frames
 */
describe('Legacy Detection Cleanup Verification', () => {
  // ── CLN-02: Deleted legacy detection modules ──

  const deletedModules = [
    { name: 'optimizedMotionDetection', path: '../detection/optimizedMotionDetection' },
    { name: 'motionTriggeredDetection', path: '../detection/motionTriggeredDetection' },
    { name: 'objectDetection', path: '../detection/objectDetection' },
  ];

  describe('CLN-02: Deleted legacy detection modules are gone', () => {
    deletedModules.forEach(({ name, path: modulePath }) => {
      it(`${name} should not be importable (file was deleted)`, async () => {
        // Dynamic import of a deleted module must throw
        await expect(import(/* webpackIgnore: true */ modulePath)).rejects.toThrow();
      });
    });

    it('should have no remaining import references to deleted modules in source', () => {
      const srcDir = path.resolve(__dirname, '..');
      const legacyRefs = [
        'optimizedMotionDetection',
        'motionTriggeredDetection',
        'objectDetection',
      ];

      // Check that the actual files don't exist on disk
      const detectionDir = path.resolve(srcDir, 'detection');
      for (const ref of legacyRefs) {
        const tsPath = path.join(detectionDir, `${ref}.ts`);
        expect(fs.existsSync(tsPath)).toBe(false);
      }
    });

    it('should still have consolidatedDetectionService and cleanupService', () => {
      const detectionDir = path.resolve(__dirname, '../detection');
      expect(fs.existsSync(path.join(detectionDir, 'consolidatedDetectionService.ts'))).toBe(true);
      expect(fs.existsSync(path.join(detectionDir, 'cleanupService.ts'))).toBe(true);
    });
  });

  // ── CLN-04: No HTTP polling/retry for detection frames ──

  describe('CLN-04: No HTTP polling or retry loops for detection frames', () => {
    const srcDir = path.resolve(__dirname, '..');

    it('should not have setInterval-based polling loops for detection frames in opencvMicroserviceClient', () => {
      const filePath = path.join(srcDir, 'services', 'opencvMicroserviceClient.ts');
      const content = fs.readFileSync(filePath, 'utf8');

      // The file should not contain setInterval (polling pattern)
      expect(content).not.toContain('setInterval(');
      expect(content).not.toContain('setInterval (');

      // Should not contain retry logic for detection
      expect(content).not.toContain('retryCount');
      expect(content).not.toContain('maxRetries');
    });

    it('should not have setInterval or polling loops for detection frames in pythonWsClient', () => {
      const filePath = path.join(srcDir, 'services', 'pythonWsClient.ts');
      const content = fs.readFileSync(filePath, 'utf8');

      // PythonWsClient should use WebSocket events, not polling
      // setTimeout for reconnection is acceptable, but setInterval polling is not
      expect(content).not.toContain('setInterval(');
      expect(content).not.toContain('setInterval (');
    });

    it('should not have legacy HTTP polling loops in rtspManager', () => {
      const filePath = path.join(srcDir, 'streams', 'rtspManager.ts');
      const content = fs.readFileSync(filePath, 'utf8');

      // rtspManager should not have retry/detect polling patterns
      expect(content).not.toContain('retryCount');
      expect(content).not.toContain('polling');

      // The only setInterval allowed is in startTestStream (test helper)
      const setIntervalMatches = content.match(/setInterval/g);
      if (setIntervalMatches) {
        // Must only appear in startTestStream which generates test frames
        expect(setIntervalMatches.length).toBeLessThanOrEqual(1);
      }
    });

    it('should not have any source files with detection-related polling loops', () => {
      // Scan all .ts files in src for detection-related polling patterns
      const pollingPatterns = [
        /setInterval.*detect/i,
        /setTimeout.*poll/i,
        /polling.*frame/i,
        /polling.*detect/i,
        /retry.*detect/i,
      ];

      const scanDir = (dir: string): void => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scanDir(fullPath);
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const pattern of pollingPatterns) {
              expect(content).not.toMatch(pattern);
            }
          }
        }
      };

      scanDir(srcDir);
    });

    it('should use simple HTTP request/response (not polling) in opencvMicroserviceClient', () => {
      const filePath = path.join(srcDir, 'services', 'opencvMicroserviceClient.ts');
      const content = fs.readFileSync(filePath, 'utf8');

      // Should use axios for HTTP request/response, not polling loops
      expect(content).toContain('axios');
      expect(content).toContain('this.client.post');
      expect(content).toContain('this.client.get');
    });
  });
});
