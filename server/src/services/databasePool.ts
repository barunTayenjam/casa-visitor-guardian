import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PoolConfig {
  maxConnections: number;
  idleTimeout: number;
  acquireTimeout: number;
}

class DatabasePool {
  private config: PoolConfig;
  private pool: Database[] = [];
  private waitingQueue: Array<{
    resolve: (db: Database) => void;
    reject: (error: Error) => void;
    timestamp: number;
    timeoutId: NodeJS.Timeout;
  }> = [];
  private dbPath: string;

  constructor(dbPath: string, config: Partial<PoolConfig> = {}) {
    this.dbPath = dbPath;
    this.config = {
      maxConnections: config.maxConnections || 10,
      idleTimeout: config.idleTimeout || 30000,
      acquireTimeout: config.acquireTimeout || 5000,
      ...config
    };
  }

  async initialize(): Promise<void> {
    // Create initial connections
    for (let i = 0; i < Math.min(3, this.config.maxConnections); i++) {
      const db = await this.createConnection();
      this.pool.push(db);
    }
    
    // Setup cleanup interval
    setInterval(() => this.cleanupIdleConnections(), this.config.idleTimeout);
  }

  private async createConnection(): Promise<Database> {
    return open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });
  }

  async acquire(): Promise<Database> {
    // Try to get an available connection from pool
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    // Create new connection if under max limit
    if (this.pool.length + this.waitingQueue.length < this.config.maxConnections) {
      return this.createConnection();
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Database connection timeout'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push({
        resolve,
        reject,
        timestamp: Date.now(),
        timeoutId: timeout as any
      });
    });
  }

  async release(db: Database): Promise<void> {
    // Check if there are waiting requests
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      clearTimeout(waiter.timestamp);
      waiter.resolve(db);
      return;
    }

    // Add back to pool if not too many connections
    if (this.pool.length < this.config.maxConnections) {
      this.pool.push(db);
      return;
    }

    // Close excess connection
    await db.close();
  }

  async execute<T>(query: string, params: any[] = []): Promise<T[]> {
    const db = await this.acquire();
    try {
      const result = await db.all(query, params);
      return result as T[];
    } finally {
      await this.release(db);
    }
  }

  async executeOne<T>(query: string, params: any[] = []): Promise<T | null> {
    const db = await this.acquire();
    try {
      const result = await db.get(query, params);
      return result as T || null;
    } finally {
      await this.release(db);
    }
  }

  async executeRun(query: string, params: any[] = []): Promise<{lastID: number, changes: number}> {
    const db = await this.acquire();
    try {
      const result = await db.run(query, params);
      return {
        lastID: result.lastID || 0,
        changes: result.changes || 0
      };
    } finally {
      await this.release(db);
    }
  }

  private cleanupIdleConnections(): void {
    // Keep a minimum of 2 connections in the pool
    const targetSize = Math.max(2, Math.floor(this.config.maxConnections * 0.3));
    
    while (this.pool.length > targetSize) {
      const db = this.pool.pop()!;
      db.close().catch(console.error);
    }
  }

  async close(): Promise<void> {
    // Close all connections
    const allConnections = [...this.pool];
    this.pool = [];
    
    // Reject all waiting requests
    this.waitingQueue.forEach(waiter => {
      clearTimeout(waiter.timeoutId as any);
      waiter.reject(new Error('Database pool closing'));
    });
    this.waitingQueue = [];

    // Close all connections
    await Promise.all(allConnections.map(db => db.close()));
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      waitingQueue: this.waitingQueue.length,
      maxConnections: this.config.maxConnections
    };
  }
}

// Singleton instances
const pools = new Map<string, DatabasePool>();

export async function getDatabasePool(dbPath: string, config?: Partial<PoolConfig>): Promise<DatabasePool> {
  if (!pools.has(dbPath)) {
    const pool = new DatabasePool(dbPath, config);
    await pool.initialize();
    pools.set(dbPath, pool);
  }
  return pools.get(dbPath)!;
}

export default DatabasePool;