import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('boot-time migration runner', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let applyPendingMigrations: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: jest.Mock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fakeDb: any;
  let migrationsDir: string;
  const applied = new Set<string>();

  beforeAll(async () => {
    ({ applyPendingMigrations } = await import('../applyMigrations.js'));

    migrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-migrations-'));
    fs.writeFileSync(path.join(migrationsDir, '001_first.sql'), 'CREATE TABLE a ();');
    fs.writeFileSync(path.join(migrationsDir, '002_second.sql'), 'CREATE TABLE b ();');

    query = jest.fn(async (sql: string, params?: string[]) => {
      // Minimal in-memory semantics of the migrations bookkeeping table.
      if (sql.startsWith('SELECT id FROM migrations')) {
        return Array.from(applied).map((id) => ({ id }));
      }
      if (sql.startsWith('INSERT INTO migrations')) {
        applied.add(params?.[0] ?? '');
        return [];
      }
      return [];
    });
    fakeDb = { query };

    process.env.MIGRATIONS_DIR = migrationsDir;
  });

  afterAll(() => {
    fs.rmSync(migrationsDir, { recursive: true, force: true });
    delete process.env.MIGRATIONS_DIR;
  });

  it('executes pending migrations and records them, in filename order', async () => {
    const result = await applyPendingMigrations(fakeDb);
    expect(result.applied).toEqual(['001_first', '002_second']);
    const executedSql = query.mock.calls.map((c) => String(c[0]));
    expect(executedSql).toEqual(
      expect.arrayContaining(['CREATE TABLE a ();', 'CREATE TABLE b ();']),
    );
    const firstIndex = executedSql.indexOf('CREATE TABLE a ();');
    const secondIndex = executedSql.indexOf('CREATE TABLE b ();');
    expect(firstIndex).toBeLessThan(secondIndex);
  });

  it('is idempotent — a second run executes nothing', async () => {
    query.mockClear();
    const result = await applyPendingMigrations(fakeDb);
    expect(result.applied).toEqual([]);
    const executedSql = query.mock.calls.map((c) => String(c[0]));
    expect(executedSql).not.toEqual(expect.arrayContaining(['CREATE TABLE a ();']));
  });

  it('ensures the migrations bookkeeping table exists first', async () => {
    const tableSql = query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(tableSql).toMatch(/CREATE TABLE IF NOT EXISTS migrations/);
  });
});
