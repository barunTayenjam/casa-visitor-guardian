import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Points at repo database/migrations (server/src/database/__tests__ -> ../../..)
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'database',
  'migrations',
);

describe('040 query-support indexes migration', () => {
  const sql = fs.readFileSync(path.join(migrationsDir, '040_add_query_indexes.sql'), 'utf-8');

  it('adds composite index for user_id+is_active session lookups', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions\s*\(user_id,\s*is_active\)/,
    );
  });

  it('adds index for detection_files.original_filename joins', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_detection_files_original_filename ON detection_files\s*\(original_filename\)/,
    );
  });
});
