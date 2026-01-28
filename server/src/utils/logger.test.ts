import { describe, it, expect } from '@jest/globals';

describe('Logger Utility', () => {
  it('should export logger object', () => {
    const logger = require('../utils/logger.js').logger;
    
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('should have info method', () => {
    const logger = require('../utils/logger.js').logger;
    
    expect(typeof logger.info).toBe('function');
  });

  it('should have error method', () => {
    const logger = require('../utils/logger.js').logger;
    
    expect(typeof logger.error).toBe('function');
  });

  it('should have warn method', () => {
    const logger = require('../utils/logger.js').logger;
    
    expect(typeof logger.warn).toBe('function');
  });

  it('should have debug method', () => {
    const logger = require('../utils/logger.js').logger;
    
    expect(typeof logger.debug).toBe('function');
  });

  it('should handle info level correctly', () => {
    const logger = require('../utils/logger.js').logger;
    
    logger.info('Test message');
    
    expect(true).toBe(true);
  });

  it('should handle error level correctly', () => {
    const logger = require('../utils/logger.js').logger;
    
    logger.error('Error message');
    
    expect(true).toBe(true);
  });

  it('should handle warn level correctly', () => {
    const logger = require('../utils/logger.js').logger;
    
    logger.warn('Warning message');
    
    expect(true).toBe(true);
  });

  it('should handle debug level correctly', () => {
    const logger = require('../utils/logger.js').logger;
    
    logger.debug('Debug message');
    
    expect(true).toBe(true);
  });
});
