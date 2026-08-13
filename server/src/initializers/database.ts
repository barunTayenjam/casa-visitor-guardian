import { AppDataSource, initializeDatabase } from '../database.js';
import { logger } from '../utils/logger.js';

export async function initializeDb(): Promise<void> {
  try {
    await initializeDatabase();
    logger.info('Database services initialized.', 'Initializer');
  } catch (error) {
    logger.error('Failed to initialize database services.', 'Initializer', error);
    process.exit(1); // Exit if essential service fails
  }
}

export async function shutdownDb(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('Database connection closed.', 'Initializer');
    }
  } catch (error) {
    logger.error('Error during database shutdown', 'Initializer', error);
  }
}
