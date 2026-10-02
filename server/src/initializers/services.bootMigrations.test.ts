import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

describe('boot wiring: migrations before service init', () => {
  const source = fs.readFileSync(path.join(srcDir, 'services.ts'), 'utf8');

  it('applies pending migrations during initializeServices', () => {
    expect(source).toMatch(/applyPendingMigrations/);
  });

  it('runs migrations BEFORE automatedCleanupService.initialize (cleanup needs schema)', () => {
    const migrationsAt = source.indexOf('applyPendingMigrations');
    const cleanupAt = source.indexOf('automatedCleanupService.initialize');
    expect(migrationsAt).toBeGreaterThan(-1);
    expect(cleanupAt).toBeGreaterThan(-1);
    expect(migrationsAt).toBeLessThan(cleanupAt);
  });
});
