import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

describe('automatedCleanupService detection purge call site', () => {
  const source = fs.readFileSync(path.join(srcDir, 'automatedCleanupService.ts'), 'utf8');

  it('resolves detection retention via resolveDetectionRetentionDays', () => {
    expect(source).toMatch(/resolveDetectionRetentionDays\(/);
  });

  it('no longer floors detection retention with min(detection, event)', () => {
    expect(source).not.toMatch(/Math\.min\(detectionDays/);
  });
});
