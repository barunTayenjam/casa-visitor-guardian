
import { DataSource } from 'typeorm';
import { config } from './config/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load all entity files from models directory, excluding test files
const modelsDir = path.join(__dirname, 'models');
const entityFiles = fs.readdirSync(modelsDir)
  .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map(file => path.join(modelsDir, file));

// Note: Entities are registered to allow Repository usage
// but direct SQL queries are also used in some places.

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  entities: entityFiles,
  synchronize: false, // Never use TRUE in production!
  logging: config.nodeEnv === 'development',
  migrations: ['dist/migrations/*.js'],
});

export async function initializeDatabase() {
  try {
    if (AppDataSource.isInitialized) {
      console.log('Database already initialized, skipping...');
      return;
    }
    await AppDataSource.initialize();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}
