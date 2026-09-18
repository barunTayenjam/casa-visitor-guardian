import { logger } from '../utils/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number; // consecutive failures
  cooldownMs: number; // time to wait in OPEN state
  successThreshold: number; // successes needed in HALF_OPEN to close
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private options: CircuitBreakerOptions;
  private serviceName: string;
  private cooldownMs: number;

  constructor(serviceName: string, options: CircuitBreakerOptions) {
    this.serviceName = serviceName;
    this.options = options;
    this.cooldownMs = options.cooldownMs;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.failures = 0;
        this.successes = 0;
        logger.info(
          `Circuit breaker for ${this.serviceName} changed state to HALF_OPEN`,
          'CircuitBreaker',
        );
      } else {
        throw new Error(`Circuit breaker for ${this.serviceName} is OPEN`);
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.cooldownMs = this.options.cooldownMs;
        logger.info(
          `Circuit breaker for ${this.serviceName} changed state to CLOSED`,
          'CircuitBreaker',
        );
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'CLOSED' && this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(
        `Circuit breaker for ${this.serviceName} changed state to OPEN`,
        'CircuitBreaker',
      );
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.cooldownMs = Math.min(this.cooldownMs * 2, this.options.cooldownMs * 8);
      logger.warn(
        `Circuit breaker for ${this.serviceName} changed state to OPEN (cooldown ${this.cooldownMs}ms)`,
        'CircuitBreaker',
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
