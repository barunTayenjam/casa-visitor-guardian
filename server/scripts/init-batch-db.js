#!/usr/bin/env node

import { getBatchProcessingDatabase } from '../src/services/batchProcessingDatabase.js';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const DB_DIR = path.join(__dirname, '../server/data');

async function initializeDatabase() {
  console.log('Initializing batch processing database...');
  
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      console.log('Created data directory');
    }

    // Initialize database (this will create tables)
    const db = await getBatchProcessingDatabase();
    
    // Test database functionality
    const stats = await db.getDatabaseStats();
    console.log('Database initialized successfully:', stats);
    
    console.log('✅ Batch processing database is ready!');
    console.log(`📍 Database location: ${path.join(DB_DIR, 'batch_processing.db')}`);
    console.log('\nFeatures enabled:');
    console.log('  • Job persistence across server restarts');
    console.log('  • Duplicate image detection');
    console.log('  • Detailed processing history');
    console.log('  • Advanced search and filtering');
    console.log('  • Performance analytics');
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export default initializeDatabase;