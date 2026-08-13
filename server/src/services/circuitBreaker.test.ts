import { describe, it, expect } from '@jest/globals';
import { CircuitBreaker } from './circuitBreaker.js';

describe('CircuitBreaker', () => {
  it('stays CLOSED on success', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      cooldownMs: 100,
      successThreshold: 1,
    });
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after threshold failures', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      cooldownMs: 100,
      successThreshold: 1,
    });
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('rejects immediately when OPEN (within cooldown)', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 1,
      cooldownMs: 10000,
      successThreshold: 1,
    });
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN');
    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(
      'Circuit breaker for test is OPEN',
    );
  });

  it('transitions to HALF_OPEN after cooldown, then CLOSED on success', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 1,
      cooldownMs: 50,
      successThreshold: 1,
    });
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN');
    await new Promise((r) => setTimeout(r, 60));
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
  });
});
