import { Server as SocketIOServer } from 'socket.io';
import { startCronJobs, runStartupCleanup, runStartupTimelapseCatchup } from '../utils/cronJobs.js';
import { logger } from '../utils/logger.js';

export async function initializeCron(io: SocketIOServer): Promise<void> {
  try {
    startCronJobs(io);
    await runStartupCleanup();
    await runStartupTimelapseCatchup();
    logger.info('Cron jobs initialized.', 'Initializer');
  } catch (error) {
    logger.error('Failed to initialize cron jobs.', 'Initializer', error);
  }
}
