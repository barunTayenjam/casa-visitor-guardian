
import { DataSource } from 'typeorm';
import { config } from './config/index.js';
import { User, Role, PasswordHistory, Event } from './models/index.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  entities: [User, Role, PasswordHistory, Event],
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
