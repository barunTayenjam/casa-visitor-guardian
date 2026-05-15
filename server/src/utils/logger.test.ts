import { describe, it, expect } from '@jest/globals';
import { logger } from '../utils/logger.js';

describe('Logger Utility', () => {
  describe('Logger object structure', () => {
    it('should export logger object', () => {
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('object');
    });

    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Component tagging', () => {
    it('should accept source tag on info method', () => {
      expect(() => logger.info('Test message', 'TestComponent')).not.toThrow();
    });

    it('should accept source tag on error method', () => {
      expect(() => logger.error('Error message', 'ErrorComponent')).not.toThrow();
    });

    it('should accept source tag on warn method', () => {
      expect(() => logger.warn('Warning', 'WarnComponent')).not.toThrow();
    });

    it('should accept metadata object on info method', () => {
      expect(() =>
        logger.info('Test with metadata', 'TestComponent', { key: 'value' })
      ).not.toThrow();
    });

    it('should accept error object on error method', () => {
      const testError = new Error('Test error');
      expect(() =>
        logger.error('Error occurred', 'ErrorComponent', testError)
      ).not.toThrow();
    });
  });

  describe('Log level filtering', () => {
    it('should handle info level without errors', () => {
      expect(() => logger.info('Test info message')).not.toThrow();
    });

    it('should handle error level without errors', () => {
      expect(() => logger.error('Test error message')).not.toThrow();
    });

    it('should handle warn level without errors', () => {
      expect(() => logger.warn('Test warning')).not.toThrow();
    });

    it('should handle debug level without errors', () => {
      expect(() => logger.debug('Test debug message')).not.toThrow();
    });
  });

  describe('Specialized logger methods', () => {
    it('should have socketConnect method', () => {
      expect(typeof logger.socketConnect).toBe('function');
      expect(() =>
        logger.socketConnect('socket-1', '127.0.0.1', 5)
      ).not.toThrow();
    });

    it('should have socketDisconnect method', () => {
      expect(typeof logger.socketDisconnect).toBe('function');
      expect(() =>
        logger.socketDisconnect('socket-1', 'client disconnect', 4)
      ).not.toThrow();
    });

    it('should have socketError method', () => {
      expect(typeof logger.socketError).toBe('function');
      expect(() =>
        logger.socketError('socket-1', new Error('Socket error'))
      ).not.toThrow();
    });

    it('should have streamRequest method', () => {
      expect(typeof logger.streamRequest).toBe('function');
      expect(() =>
        logger.streamRequest('cam1', 'socket-1')
      ).not.toThrow();
    });

    it('should have streamStop method', () => {
      expect(typeof logger.streamStop).toBe('function');
      expect(() =>
        logger.streamStop('cam1', 'socket-1')
      ).not.toThrow();
    });

    it('should have serverStart method', () => {
      expect(typeof logger.serverStart).toBe('function');
      expect(() => logger.serverStart(9753)).not.toThrow();
    });

    it('should have corsBlock method', () => {
      expect(typeof logger.corsBlock).toBe('function');
      expect(() => logger.corsBlock('http://evil.com', 'socket')).not.toThrow();
      expect(() => logger.corsBlock('http://evil.com', 'http')).not.toThrow();
    });

    it('should have apiRequest method', () => {
      expect(typeof logger.apiRequest).toBe('function');
      expect(() =>
        logger.apiRequest('GET', '/api/events', '127.0.0.1', 'Mozilla/5.0')
      ).not.toThrow();
    });

    it('should have apiResponse method', () => {
      expect(typeof logger.apiResponse).toBe('function');
      expect(() =>
        logger.apiResponse('GET', '/api/events', 200, 45)
      ).not.toThrow();
    });

    it('should have apiError method', () => {
      expect(typeof logger.apiError).toBe('function');
      expect(() =>
        logger.apiError('POST', '/api/events', new Error('Server error'), 500)
      ).not.toThrow();
    });

    it('should have motionDetected method', () => {
      expect(typeof logger.motionDetected).toBe('function');
      expect(() =>
        logger.motionDetected('cam1', 85.5, '2026-01-01T00:00:00Z')
      ).not.toThrow();
    });

    it('should have motionError method', () => {
      expect(typeof logger.motionError).toBe('function');
      expect(() =>
        logger.motionError('cam1', new Error('Motion error'))
      ).not.toThrow();
    });

    it('should have performance method', () => {
      expect(typeof logger.performance).toBe('function');
      expect(() =>
        logger.performance('cpu_usage', 45.2, '%')
      ).not.toThrow();
    });

    it('should have memoryUsage method', () => {
      expect(typeof logger.memoryUsage).toBe('function');
      expect(() =>
        logger.memoryUsage(100 * 1024 * 1024, 200 * 1024 * 1024, 50 * 1024 * 1024)
      ).not.toThrow();
    });
  });
});
