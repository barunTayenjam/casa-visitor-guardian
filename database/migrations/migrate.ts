// File: database/migrations/migrate.ts
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { logger } from '../../server/src/utils/logger';

interface Migration {
  id: string;
  name: string;
  sql: string;
  checksum: string;
}

class MigrationManager {
  private pool: Pool;
  private migrationsPath: string;

  constructor(pool: Pool, migrationsPath: string) {
    this.pool = pool;
    this.migrationsPath = migrationsPath;
  }

  async initializeMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.pool.query(sql);
  }

  async loadMigrations(): Promise<Migration[]> {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const sql = fs.readFileSync(path.join(this.migrationsPath, file), 'utf8');
      const checksum = this.calculateChecksum(sql);
      
      return {
        id: file.replace('.sql', ''),
        name: file,
        sql,
        checksum
      };
    });
  }

  async getExecutedMigrations(): Promise<string[]> {
    const result = await this.pool.query('SELECT id FROM migrations ORDER BY id');
    return result.rows.map((row: any) => row.id);
  }

  async executeMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute migration SQL
      await client.query(migration.sql);
      
      // Record migration
      await client.query(
        'INSERT INTO migrations (id, name, checksum) VALUES ($1, $2, $3)',
        [migration.id, migration.name, migration.checksum]
      );
      
      await client.query('COMMIT');
      logger.info(`Migration ${migration.name} executed successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration ${migration.name} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async migrate(): Promise<void> {
    await this.initializeMigrationsTable();
    
    const migrations = await this.loadMigrations();
    const executed = await this.getExecutedMigrations();
    const pending = migrations.filter(m => !executed.includes(m.id));

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Executing ${pending.length} pending migrations`);
    
    for (const migration of pending) {
      await this.executeMigration(migration);
    }
    
    logger.info('All migrations completed successfully');
  }

  private calculateChecksum(sql: string): string {
    return createHash('sha256').update(sql).digest('hex');
  }
}

export { MigrationManager };