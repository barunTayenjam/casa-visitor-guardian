import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLN-03: Verify rtspManager.ts is simplified to Socket.io frame relay
 * - No ffmpeg-static import
 * - No spawn/ChildProcess import
 * - No CameraStream interface
 * - No mainProcess/activeRoles/streams/retryCount fields on Camera
 * - getProcess() returns null
 * - No FFmpeg subprocess management
 */

describe('RTSP Manager Simplification (CLN-03)', () => {
  const srcDir = path.resolve(__dirname);
  const rtspManagerPath = path.join(srcDir, 'rtspManager.ts');

  describe('Source file does not contain FFmpeg/spawn imports', () => {
    let source: string;

    beforeAll(() => {
      source = fs.readFileSync(rtspManagerPath, 'utf8');
    });

    it('should not import ffmpeg-static', () => {
      expect(source).not.toMatch(/ffmpeg-static/);
      expect(source).not.toMatch(/ffmpeg/);
    });

    it('should not import spawn or ChildProcess from child_process', () => {
      expect(source).not.toMatch(/from ['"]child_process['"]/);
      expect(source).not.toMatch(/spawn/);
      expect(source).not.toMatch(/ChildProcess/);
    });

    it('should not contain CameraStream interface', () => {
      expect(source).not.toMatch(/CameraStream/);
    });

    it('should not contain MJPEG parsing references', () => {
      expect(source).not.toMatch(/MJPEG/);
      expect(source).not.toMatch(/mjpeg/i);
    });

    it('should not reference legacy Camera fields (mainProcess, activeRoles, streams map, retryCount)', () => {
      expect(source).not.toMatch(/mainProcess/);
      expect(source).not.toMatch(/activeRoles/);
      expect(source).not.toMatch(/retryCount/);
    });

    it('should not reference processFrameForMotion', () => {
      expect(source).not.toMatch(/processFrameForMotion/);
    });

    it('should not reference dual pipeline or pythonEnabled legacy logic', () => {
      expect(source).not.toMatch(/pythonEnabled/);
      expect(source).not.toMatch(/dual.*pipeline/i);
    });
  });

  describe('Camera interface does not contain legacy fields', () => {
    let source: string;

    beforeAll(() => {
      source = fs.readFileSync(rtspManagerPath, 'utf8');
    });

    it('should define Camera interface without mainProcess, activeRoles, streams, or retryCount', () => {
      // Find the Camera interface declaration
      const interfaceMatch = source.match(/export interface Camera \{[\s\S]*?^\}/m);
      expect(interfaceMatch).not.toBeNull();

      const cameraInterface = interfaceMatch![0];
      // Should NOT have legacy fields
      expect(cameraInterface).not.toMatch(/mainProcess/);
      expect(cameraInterface).not.toMatch(/activeRoles/);
      expect(cameraInterface).not.toMatch(/streams/);
      expect(cameraInterface).not.toMatch(/retryCount/);

      // Should have the simplified fields
      expect(cameraInterface).toMatch(/id/);
      expect(cameraInterface).toMatch(/lastFrame/);
      expect(cameraInterface).toMatch(/activeViewers/);
      expect(cameraInterface).toMatch(/isActive/);
      expect(cameraInterface).toMatch(/adaptiveFps/);
    });
  });

  describe('StreamManager class structure', () => {
    let source: string;

    beforeAll(() => {
      source = fs.readFileSync(rtspManagerPath, 'utf8');
    });

    it('should have getProcess method that returns null', () => {
      expect(source).toMatch(/getProcess.*null/);
      expect(source).toMatch(/getProcess[^}]*null/);
    });

    it('should have wirePythonWsFrames method for Socket.io relay', () => {
      expect(source).toMatch(/wirePythonWsFrames/);
    });

    it('should have startStream/stopStream simplified to subscribe/unsubscribe via PythonWsClient', () => {
      // Should contain pythonWs.subscribe and pythonWs.unsubscribe
      expect(source).toMatch(/pythonWs\.subscribe/);
      expect(source).toMatch(/pythonWs\.unsubscribe/);
    });

    it('should maintain Socket.io frame relay and viewer tracking', () => {
      expect(source).toMatch(/activeViewers/);
      expect(source).toMatch(/\badaptiveFps\b/);
      expect(source).toMatch(/io\.to.*emit.*frame/);
    });

    it('should still have startTestStream as a test helper', () => {
      expect(source).toMatch(/startTestStream/);
    });

    it('should still have takeSnapshot capability', () => {
      expect(source).toMatch(/takeSnapshot/);
    });

    it('should still have simulateMotionDetection for manual testing', () => {
      expect(source).toMatch(/simulateMotionDetection/);
    });
  });

  describe('Simplified class behavior', () => {
    // Note: Full behavioral testing requires Socket.io server and service mocking.
    // These structural tests verify the class follows the simplified contract.

    it('getProcess always returns null at runtime', async () => {
      // Dynamic import to avoid compile-time dependency issues in test isolation
      const mod = await import('./rtspManager.js');
      const { StreamManager } = mod;

      // Create a mock Socket.io server
      const mockIo = {
        on: jest.fn(),
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as any;

      // We need to handle the fact that constructor calls serviceRegistry.getPythonWsClient()
      // which might throw. This test verifies the structural contract.
      expect(typeof StreamManager.prototype.getProcess).toBe('function');
      // The method signature should accept (cameraId, role) and return null
      const getProcessStr = StreamManager.prototype.getProcess.toString();
      expect(getProcessStr).toContain('null');
      expect(getProcessStr).not.toContain('mainProcess');
    });

    it('getStream method returns width/height from config, not internal state', async () => {
      const mod = await import('./rtspManager.js');
      const { StreamManager } = mod;

      const getStreamStr = StreamManager.prototype.getStream.toString();
      // Should read from camera.config.streams, not from internal stream state
      expect(getStreamStr).toContain('camera.config');
      expect(getStreamStr).not.toContain('CameraStream');
      expect(getStreamStr).not.toContain('.streams.get');
    });

    it('should export streamManager singleton', async () => {
      const mod = await import('./rtspManager.js');
      expect(mod).toHaveProperty('streamManager');
      expect(mod).toHaveProperty('setupRTSPStreams');
    });
  });

  describe('Source file kept essential functionality', () => {
    let source: string;

    beforeAll(() => {
      source = fs.readFileSync(rtspManagerPath, 'utf8');
    });

    it('should keep the StreamManager class export', () => {
      expect(source).toMatch(/export class StreamManager/);
    });

    it('should keep socket.io import for frame relay', () => {
      expect(source).toMatch(/socket\.io/);
    });

    it('should still have health monitoring integration', () => {
      expect(source).toMatch(/healthMonitor/);
    });

    it('should NOT import from detection modules', () => {
      expect(source).not.toMatch(/detection\//);
    });
  });
});
