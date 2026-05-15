import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OptimizedMotionDetector } from './optimizedMotionDetection.js';

// ---- Pure utility function extraction for testing ----
// These functions replicate the private logic from OptimizedMotionDetector
// to allow unit testing without external dependencies.

function isQuietHours(
  quietHours: { start: string; end: string },
  testTime?: string
): boolean {
  const now = testTime
    ? { getHours: () => parseInt(testTime.split(':')[0]), getMinutes: () => parseInt(testTime.split(':')[1]) }
    : new Date();
  const currentTime = `${(now as any).getHours().toString().padStart(2, '0')}:${(now as any).getMinutes().toString().padStart(2, '0')}`;

  if (quietHours.start <= quietHours.end) {
    return currentTime >= quietHours.start && currentTime <= quietHours.end;
  } else {
    return currentTime >= quietHours.start || currentTime <= quietHours.end;
  }
}

function getAdaptiveSensitivity(
  sensitivity: number,
  timeZones: Record<string, { start: string; end: string; sensitivityMultiplier: number }>,
  testTime?: string
): number {
  const now = testTime
    ? { getHours: () => parseInt(testTime.split(':')[0]), getMinutes: () => parseInt(testTime.split(':')[1]) }
    : new Date();
  const currentTime = `${(now as any).getHours().toString().padStart(2, '0')}:${(now as any).getMinutes().toString().padStart(2, '0')}`;

  for (const [, zoneConfig] of Object.entries(timeZones)) {
    const { start, end, sensitivityMultiplier } = zoneConfig;
    let inZone = false;

    if (start <= end) {
      inZone = currentTime >= start && currentTime <= end;
    } else {
      inZone = currentTime >= start || currentTime <= end;
    }

    if (inZone) {
      const adjusted = sensitivity * sensitivityMultiplier;
      return Math.min(100, adjusted);
    }
  }

  return sensitivity;
}

function estimateLightLevel(frame: Buffer): number {
  if (frame.length < 1000) return 50;

  let totalBrightness = 0;
  const sampleSize = Math.min(100, Math.floor(frame.length / 10));

  for (let i = 0; i < sampleSize; i++) {
    const sampleIndex = Math.floor((i * 137 + 50) % (frame.length - 100)) + 50;
    totalBrightness += frame[sampleIndex];
  }

  return Math.round((totalBrightness / sampleSize / 255) * 100);
}

// ---- Mock types ----
interface MockStreamManager {
  getAllCameras: jest.Mock;
  getCamera: jest.Mock;
  getLastFrame: jest.Mock;
}

interface MockIO {
  emit: jest.Mock;
  on: jest.Mock;
}

function createMockStreamManager(): MockStreamManager {
  return {
    getAllCameras: jest.fn().mockReturnValue([]),
    getCamera: jest.fn().mockReturnValue(undefined),
    getLastFrame: jest.fn().mockReturnValue(null),
  };
}

function createMockIO(): MockIO {
  return {
    emit: jest.fn(),
    on: jest.fn(),
  };
}

describe('OptimizedMotionDetector - Confidence Calculation', () => {
  describe('estimateLightLevel', () => {
    it('should return default 50 for small frames (below 1000 bytes)', () => {
      const smallFrame = Buffer.alloc(500, 128);
      expect(estimateLightLevel(smallFrame)).toBe(50);
    });

    it('should return 0 for completely dark frame (all zeros)', () => {
      const darkFrame = Buffer.alloc(2000, 0);
      expect(estimateLightLevel(darkFrame)).toBe(0);
    });

    it('should return 100 for completely bright frame (all 255)', () => {
      const brightFrame = Buffer.alloc(2000, 255);
      expect(estimateLightLevel(brightFrame)).toBe(100);
    });

    it('should return ~50 for mid-gray frame (all 128)', () => {
      const grayFrame = Buffer.alloc(2000, 128);
      const result = estimateLightLevel(grayFrame);
      expect(result).toBeGreaterThanOrEqual(45);
      expect(result).toBeLessThanOrEqual(55);
    });

    it('should return value proportional to brightness for mixed frame', () => {
      const mixedFrame = Buffer.alloc(2000, 64); // ~25% brightness
      const result = estimateLightLevel(mixedFrame);
      expect(result).toBeGreaterThanOrEqual(20);
      expect(result).toBeLessThanOrEqual(30);
    });
  });
});

describe('OptimizedMotionDetector - Zone/Time-based Sensitivity', () => {
  const timeZones = {
    day: { start: '06:00', end: '22:00', sensitivityMultiplier: 1.0 },
    night: { start: '22:00', end: '06:00', sensitivityMultiplier: 1.2 },
  };

  describe('getAdaptiveSensitivity', () => {
    it('should return base sensitivity during daytime (12:00)', () => {
      const result = getAdaptiveSensitivity(50, timeZones, '12:00');
      expect(result).toBe(50); // 50 * 1.0 = 50
    });

    it('should increase sensitivity during nighttime (23:00)', () => {
      const result = getAdaptiveSensitivity(50, timeZones, '23:00');
      expect(result).toBe(60); // 50 * 1.2 = 60
    });

    it('should increase sensitivity during early morning night (03:00)', () => {
      const result = getAdaptiveSensitivity(50, timeZones, '03:00');
      expect(result).toBe(60); // 50 * 1.2 = 60
    });

    it('should cap sensitivity at 100 maximum', () => {
      const result = getAdaptiveSensitivity(90, timeZones, '23:00');
      expect(result).toBe(100); // 90 * 1.2 = 108, capped at 100
    });

    it('should return base sensitivity at exact day boundary (06:00)', () => {
      const result = getAdaptiveSensitivity(50, timeZones, '06:00');
      expect(result).toBe(50);
    });

    it('should return base sensitivity at exact evening boundary (22:00)', () => {
      const result = getAdaptiveSensitivity(50, timeZones, '22:00');
      expect(result).toBe(50);
    });

    it('should return base sensitivity when no time zones match', () => {
      const emptyZones: Record<string, { start: string; end: string; sensitivityMultiplier: number }> = {};
      const result = getAdaptiveSensitivity(75, emptyZones, '12:00');
      expect(result).toBe(75);
    });
  });
});

describe('OptimizedMotionDetector - Cooldown Logic', () => {
  describe('isQuietHours', () => {
    const quietHours = { start: '22:00', end: '06:00' };

    it('should return false during daytime (12:00)', () => {
      expect(isQuietHours(quietHours, '12:00')).toBe(false);
    });

    it('should return true during nighttime (23:00)', () => {
      expect(isQuietHours(quietHours, '23:00')).toBe(true);
    });

    it('should return true during early morning (03:00)', () => {
      expect(isQuietHours(quietHours, '03:00')).toBe(true);
    });

    it('should return false at boundary time (07:00)', () => {
      expect(isQuietHours(quietHours, '07:00')).toBe(false);
    });

    it('should return true at start boundary (22:00)', () => {
      expect(isQuietHours(quietHours, '22:00')).toBe(true);
    });

    it('should return true at end boundary (06:00)', () => {
      expect(isQuietHours(quietHours, '06:00')).toBe(true);
    });

    it('should handle same-day quiet hours (09:00-17:00)', () => {
      const businessHours = { start: '09:00', end: '17:00' };
      expect(isQuietHours(businessHours, '12:00')).toBe(true);
      expect(isQuietHours(businessHours, '08:00')).toBe(false);
      expect(isQuietHours(businessHours, '18:00')).toBe(false);
    });
  });
});

describe('OptimizedMotionDetector - Class Methods', () => {
  let mockStreamManager: MockStreamManager;
  let mockIO: MockIO;
  let detector: OptimizedMotionDetector;

  beforeEach(() => {
    mockStreamManager = createMockStreamManager();
    mockIO = createMockIO();
    detector = new OptimizedMotionDetector(
      mockStreamManager as any,
      mockIO as any
    );
  });

  afterEach(async () => {
    await detector.cleanup();
  });

  it('should create detector instance with mock dependencies', () => {
    expect(detector).toBeDefined();
  });

  it('should return null for settings of unknown camera', () => {
    expect(detector.getSettings('unknown-camera')).toBeNull();
  });

  it('should return metrics object with expected shape', () => {
    const metrics = detector.getMetrics();
    expect(metrics).toHaveProperty('totalDetections');
    expect(metrics).toHaveProperty('falsePositives');
    expect(metrics).toHaveProperty('averageProcessingTime');
    expect(metrics).toHaveProperty('memoryUsage');
    expect(metrics).toHaveProperty('cpuUsage');
    expect(metrics).toHaveProperty('lastOptimization');
  });

  it('should return false when updating settings for unknown camera', () => {
    const result = detector.updateSettings('unknown-camera', { enabled: false });
    expect(result).toBe(false);
  });

  it('should cleanup without errors', async () => {
    await expect(detector.cleanup()).resolves.not.toThrow();
  });

  it('should stop without errors when no interval is set', () => {
    detector.stop();
    expect(() => detector.stop()).not.toThrow();
  });
});
