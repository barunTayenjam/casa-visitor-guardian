import { describe, it, expect } from '@jest/globals';

describe('File Hash Utility', () => {
  it('should export fileHash function', () => {
    const { fileHash } = require('../utils/fileHash.js');
    
    expect(typeof fileHash).toBe('function');
  });

  it('should generate MD5 hash', async () => {
    const { fileHash } = require('../utils/fileHash.js');
    
    const hash = await fileHash('test content');
    
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(32);
  });

  it('should generate consistent hashes for same content', async () => {
    const { fileHash } = require('../utils/fileHash.js');
    
    const content = 'same content';
    const hash1 = await fileHash(content);
    const hash2 = await fileHash(content);
    
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', async () => {
    const { fileHash } = require('../utils/fileHash.js');
    
    const hash1 = await fileHash('content1');
    const hash2 = await fileHash('content2');
    
    expect(hash1).not.toBe(hash2);
  });

  it('should generate hash as hex string', async () => {
    const { fileHash } = require('../utils/fileHash.js');
    
    const hash = await fileHash('test');
    
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });
});
