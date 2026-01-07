
import { DataSource } from 'typeorm';
import { config } from './config/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: Entities are registered to allow Repository usage
// but direct SQL queries are also used in some places.

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  entities: [path.join(__dirname, 'models/*.{ts,js}')],
  synchronize: false, // Never use TRUE in production!
  logging: config.nodeEnv === 'development',
  migrations: ['dist/migrations/*.js'],
});

export async function initializeDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}
