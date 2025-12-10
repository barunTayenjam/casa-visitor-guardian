import { getDatabasePool } from './databasePool.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LogEntry {
  id?: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
  error_details?: string;
  metadata?: string;
  created_at?: string;
}

class LogDatabase {
  private dbPath: string;
  private pool: any;

  constructor() {
    // Use logs directory that's created in container
    this.dbPath = path.join(__dirname, '../../logs/logs.db');
  }

  async initialize(): Promise<void> {
    try {
      this.pool = await getDatabasePool(this.dbPath);
      
      // Create logs table
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
          message TEXT NOT NULL,
          source TEXT,
          error_details TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes separately
      await this.pool.execute(`CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp)`);
      await this.pool.execute(`CREATE INDEX IF NOT EXISTS idx_level ON logs(level)`);
      await this.pool.execute(`CREATE INDEX IF NOT EXISTS idx_source ON logs(source)`);
      await this.pool.execute(`CREATE INDEX IF NOT EXISTS idx_created_at ON logs(created_at)`);
      
      // Create log cleanup trigger for old records
      await this.pool.execute(`
        CREATE TRIGGER IF NOT EXISTS cleanup_old_logs
        AFTER INSERT ON logs
        BEGIN
          DELETE FROM logs 
          WHERE created_at < datetime('now', '-30 days')
          AND id < NEW.id - 100000;
        END
      `);
      
      console.log('LogDatabase initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LogDatabase:', error);
      throw error;
    }
  }

  async insertLog(entry: Omit<LogEntry, 'id' | 'created_at'>): Promise<number> {
    try {
      if (!this.pool) {
        throw new Error('Database not initialized');
      }
      
      const result = await this.pool.executeRun(`
        INSERT INTO logs (timestamp, level, message, source, error_details, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        entry.timestamp,
        entry.level,
        entry.message,
        entry.source || null,
        entry.error_details || null,
        entry.metadata || null
      ]);
      
      return result.lastID;
    } catch (error) {
      console.error('Failed to insert log into database:', error);
      return 0;
    }
  }

  async getLogs(
    limit: number = 100,
    offset: number = 0,
    level?: string,
    source?: string,
    startTime?: string,
    endTime?: string
  ): Promise<LogEntry[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params: any[] = [];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    if (startTime) {
      query += ' AND timestamp >= ?';
      params.push(startTime);
    }

    if (endTime) {
      query += ' AND timestamp <= ?';
      params.push(endTime);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await this.pool.execute(query, params) as LogEntry[];
  }

  async getLogStats(): Promise<{
    total: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
    last24h: number;
  }> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    const totalQuery = 'SELECT COUNT(*) as count FROM logs';
    const totalResult = await this.pool.executeOne(totalQuery) as {count: number};
    const total = totalResult?.count || 0;

    const byLevelQuery = `
      SELECT level, COUNT(*) as count 
      FROM logs 
      GROUP BY level
    `;
    const byLevelResults = await this.pool.execute(byLevelQuery) as {level: string, count: number}[];
    const byLevel = byLevelResults.reduce((acc, row) => {
      acc[row.level] = row.count;
      return acc;
    }, {} as Record<string, number>);

    const bySourceQuery = `
      SELECT source, COUNT(*) as count 
      FROM logs 
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY count DESC
      LIMIT 10
    `;
    const bySourceResults = await this.pool.execute(bySourceQuery) as {source: string, count: number}[];
    const bySource = bySourceResults.reduce((acc, row) => {
      acc[row.source] = row.count;
      return acc;
    }, {} as Record<string, number>);

    const last24hQuery = `
      SELECT COUNT(*) as count 
      FROM logs 
      WHERE timestamp >= datetime('now', '-24 hours')
    `;
    const last24hResult = await this.pool.executeOne(last24hQuery) as {count: number};
    const last24h = last24hResult?.count || 0;

    return {
      total,
      byLevel,
      bySource,
      last24h
    };
  }

  async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    const result = await this.pool.executeRun(`
      DELETE FROM logs 
      WHERE created_at < datetime('now', '-${daysToKeep} days')
    `);
    
    return result.changes;
  }

  async searchLogs(searchTerm: string, limit: number = 50): Promise<LogEntry[]> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    const query = `
      SELECT * FROM logs 
      WHERE message LIKE ? OR source LIKE ? OR error_details LIKE ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    const searchPattern = `%${searchTerm}%`;
    
    return await this.pool.execute(query, [
      searchPattern, searchPattern, searchPattern, limit
    ]) as LogEntry[];
  }
}

// Singleton instance
let logDatabaseInstance: LogDatabase | null = null;

export async function getLogDatabase(): Promise<LogDatabase> {
  if (!logDatabaseInstance) {
    logDatabaseInstance = new LogDatabase();
    await logDatabaseInstance.initialize();
  }
  return logDatabaseInstance;
}

export default LogDatabase;