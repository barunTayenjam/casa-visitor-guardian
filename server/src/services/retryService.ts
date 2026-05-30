import { logger } from '../utils/logger.js';

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export class RetryService {
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig>,
    context: string
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      jitter = true
    } = config;

    let lastError: Error;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`${context}: Attempt ${attempt}/${maxRetries} failed`, 'RetryService');

        if (attempt === maxRetries) {
          logger.error(`${context}: All retries exhausted`, 'RetryService');
          throw lastError;
        }

        delay = Math.min(delay * backoffFactor, maxDelay);

        if (jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        logger.info(`${context}: Retrying after ${Math.round(delay)}ms...`, 'RetryService');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}
