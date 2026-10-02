import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';

/**
 * Boot-time SQL migration runner.
 *
 * Postgres runs initdb scripts (/docker-entrypoint-initdb.d) only against an
 * EMPTY data volume — every upgrade of an existing deployment silently
 * skipped everything in database/migrations. This runner applies pending
 * *.sql files at server boot, tracked in the same `migrations(id)` table the
 * manual MigrationManager uses, so both paths agree on what "applied" means.
 */
export interface MigrationRunnerDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (sql: string, params?: any[]) => Promise<any[]>;
}

const here = path.dirname(fileURLToPath(import.meta.url));

export function resolveMigrationsDir(): string {
  // Env override for tests; otherwise the repo's database/migrations folder,
  // which is baked into dist through server/dist layout (../../database).
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const candidates = [
    // dev layout: server/src/database → ../../database/migrations
    path.resolve(here, '..', '..', '..', 'database', 'migrations'),
    // dist layout: server/dist/database → ../../../database/migrations
    path.resolve(here, '..', '..', '..', 'database', 'migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

export async function applyPendingMigrations(db: MigrationRunnerDb): Promise<{
  applied: string[];
}> {
  await db.query(`CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

  const dir = resolveMigrationsDir();
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    logger.warn(`Migrations dir ${dir} unreadable — skipping boot migrations`, 'Database');
    return { applied: [] };
  }

  const executed = await db.query('SELECT id FROM migrations ORDER BY id');
  const executedIds = new Set((executed ?? []).map((row) => String(row.id)));

  const applied: string[] = [];
  for (const file of files) {
    const id = file.replace(/\.sql$/, '');
    if (executedIds.has(id)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query('INSERT INTO migrations (id, name, checksum) VALUES ($1, $2, $3)', [
        id,
        file,
        'boot-runner',
      ]);
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
    applied.push(id);
    logger.info(`Boot migration applied: ${file}`, 'Database');
  }
  return { applied };
}
