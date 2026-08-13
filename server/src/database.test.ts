import { describe, it, expect } from '@jest/globals';

describe('Database Exports', () => {
  it('should export AppDataSource', async () => {
    const { AppDataSource } = await import('./database.js');
    expect(AppDataSource).toBeDefined();
  });

  it('should export initializeDatabase function', async () => {
    const { initializeDatabase } = await import('./database.js');
    expect(typeof initializeDatabase).toBe('function');
  });
});
