/**
 * Simple SQLite migration to add detection_cache table
 * This bypasses the PostgreSQL migration system
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../server/data/logs.db');

async function runMigration() {
  console.log('Running SQLite migration for detection_cache table...');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('Database opened successfully');
      
      // Create detection_cache table
      const sql = `
        CREATE TABLE IF NOT EXISTS detection_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_hash TEXT UNIQUE NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_modified DATETIME NOT NULL,
          object_detections TEXT,
          face_detections TEXT,
          processing_time INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_detection_cache_file_hash ON detection_cache(file_hash);
        CREATE INDEX IF NOT EXISTS idx_detection_cache_file_path ON detection_cache(file_path);
        CREATE INDEX IF NOT EXISTS idx_detection_cache_created_at ON detection_cache(created_at);
      `;
      
      db.exec(sql, (err) => {
        if (err) {
          console.error('Error creating detection_cache table:', err);
          reject(err);
          return;
        }
        
        console.log('✅ detection_cache table created successfully');
        
        // Close database
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
            reject(err);
            return;
          }
          
          console.log('✅ Migration completed successfully');
          resolve();
        });
      });
    });
  });
}

// Run migration
runMigration()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });