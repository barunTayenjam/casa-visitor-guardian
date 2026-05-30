import { logger } from '../utils/logger.js';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(private config: CircuitBreakerConfig, private name: string) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
                logger.info(`CircuitBreaker[${this.name}]: Entering HALF_OPEN state`, 'CircuitBreaker');
      } else {
        throw new Error(`CircuitBreaker[${this.name}]: Circuit is OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.failureCount = 0;
        logger.info(`CircuitBreaker[${this.name}]: Circuit CLOSED (recovered)`, 'CircuitBreaker');
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.error(`CircuitBreaker[${this.name}]: Circuit OPEN (too many failures)`, 'CircuitBreaker');
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): { state: CircuitState; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    };
  }
}

export const opencvCircuitBreaker = new CircuitBreaker(
  {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 30000
  },
  'OpenCV-Service'
);

export const databaseCircuitBreaker = new CircuitBreaker(
  {
    failureThreshold: 3,
    resetTimeout: 30000,
    monitoringPeriod: 15000
  },
  'Database'
);
