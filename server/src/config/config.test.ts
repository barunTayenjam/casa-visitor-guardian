import { describe, it, expect } from '@jest/globals';

describe('Configuration', () => {
  it('should export config object', () => {
    const config = require('../config/index.js').config;
    
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('should have port configuration', () => {
    const config = require('../config/index.js').config;
    
    expect(config.port).toBeDefined();
    expect(typeof config.port).toBe('number');
    expect(config.port).toBeGreaterThan(0);
  });

  it('should have cameras path', () => {
    const config = require('../config/index.js').config;
    
    expect(config.camerasPath).toBeDefined();
    expect(typeof config.camerasPath).toBe('string');
  });

  it('should export getOpenCVServiceUrl function', () => {
    const { getOpenCVServiceUrl } = require('../config/index.js');
    
    expect(typeof getOpenCVServiceUrl).toBe('function');
  });

  it('should get OpenCV service URL', () => {
    const { getOpenCVServiceUrl } = require('../config/index.js');
    
    const url = getOpenCVServiceUrl();
    
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
    expect(url).toContain('http');
  });

  it('should have database configuration', () => {
    const config = require('../config/index.js').config;
    
    expect(config.database).toBeDefined();
    expect(typeof config.database).toBe('object');
  });

  it('should have database host', () => {
    const config = require('../config/index.js').config;
    
    expect(config.database.host).toBeDefined();
    expect(typeof config.database.host).toBe('string');
  });

  it('should have database port', () => {
    const config = require('../config/index.js').config;
    
    expect(config.database.port).toBeDefined();
    expect(typeof config.database.port).toBe('number');
  });

  it('should have database name', () => {
    const config = require('../config/index.js').config;
    
    expect(config.database.database).toBeDefined();
    expect(typeof config.database.database).toBe('string');
  });
});
