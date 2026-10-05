import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { callNvidiaApi, getModelFallbackChain } from '../nvidiaClient.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Retryable-failure cases walk real backoff sleeps (1 model sleep each, up
 *  to 3 models), which overruns Jest's 5s default. */
const SLEEPING_TEST_TIMEOUT = 30_000;

const okCompletion = {
  choices: [{ message: { content: '{"scene_description":"ok"}' } }],
};

describe('callNvidiaApi model fallback', () => {
  beforeEach(() => {
    process.env.NVIDIA_API_KEY = 'test-key';
    process.env.NVIDIA_API_BASE_URL = 'http://llm.test/v1';
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
    process.env.NVIDIA_MODEL = 'model-a';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('advances to the next model when the first returns a retryable 503', async () => {
    const attempted: string[] = [];
    globalThis.fetch = jest.fn(async (_url: any, init: any) => {
      const model = JSON.parse(init.body).model;
      attempted.push(model);
      if (model === 'model-a') return jsonResponse({ error: { message: 'upstream down' } }, 503);
      return jsonResponse(okCompletion);
    }) as any;

    const result = await callNvidiaApi('base64', {}, 'model-a', 'prompt');

    expect(result).toEqual(okCompletion);
    expect(attempted.length).toBeGreaterThan(1);
    expect(attempted[attempted.length - 1]).not.toBe('model-a');
  }, SLEEPING_TEST_TIMEOUT);

  it('advances to the next model when the first returns a retryable 429', async () => {
    const attempted: string[] = [];
    globalThis.fetch = jest.fn(async (_url: any, init: any) => {
      const model = JSON.parse(init.body).model;
      attempted.push(model);
      if (model === 'model-a') return jsonResponse({ error: { message: 'rate limited' } }, 429);
      return jsonResponse(okCompletion);
    }) as any;

    await expect(callNvidiaApi('base64', {}, 'model-a', 'prompt')).resolves.toEqual(okCompletion);
    expect(attempted[attempted.length - 1]).not.toBe('model-a');
  }, SLEEPING_TEST_TIMEOUT);

  it('does not advance on a non-retryable 400 bad request', async () => {
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls++;
      return jsonResponse({ error: { message: 'image too large' } }, 400);
    }) as any;

    await expect(callNvidiaApi('base64', {}, 'model-a', 'prompt')).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });

  it('still advances past a 404 unknown model', async () => {
    const attempted: string[] = [];
    globalThis.fetch = jest.fn(async (_url: any, init: any) => {
      const model = JSON.parse(init.body).model;
      attempted.push(model);
      if (model === 'model-a') return jsonResponse({ error: { message: 'no such model' } }, 404);
      return jsonResponse(okCompletion);
    }) as any;

    await expect(callNvidiaApi('base64', {}, 'model-a', 'prompt')).resolves.toEqual(okCompletion);
    expect(attempted.filter((m) => m === 'model-a').length).toBe(1);
  });

  it('retries a retryable failure on the same model before advancing', async () => {
    const attempted: string[] = [];
    globalThis.fetch = jest.fn(async (_url: any, init: any) => {
      const model = JSON.parse(init.body).model;
      attempted.push(model);
      if (attempted.length <= 2) return jsonResponse({ error: { message: 'flaky' } }, 503);
      return jsonResponse(okCompletion);
    }) as any;

    await expect(callNvidiaApi('base64', {}, 'model-a', 'prompt')).resolves.toEqual(okCompletion);
    expect(attempted.slice(0, 2)).toEqual(['model-a', 'model-a']);
  }, SLEEPING_TEST_TIMEOUT);

  it('throws the last error when every model in the chain fails retryably', async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse({ error: { message: 'all down' } }, 503),
    ) as any;

    await expect(callNvidiaApi('base64', {}, 'model-a', 'prompt')).rejects.toThrow(/503/);
  }, SLEEPING_TEST_TIMEOUT);
});

describe('getModelFallbackChain', () => {
  beforeEach(() => {
    process.env.NVIDIA_API_KEY = 'test-key';
    process.env.NVIDIA_API_BASE_URL = 'http://llm.test/v1';
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('offers more than one candidate so a single dead provider cannot break analysis', () => {
    process.env.NVIDIA_MODEL = 'glm/glm-5.3-flash';
    expect(getModelFallbackChain().length).toBeGreaterThan(1);
  });

  it('does not pin every candidate to the same provider prefix', () => {
    process.env.NVIDIA_MODEL = 'glm/glm-5.3-flash';
    const chain = getModelFallbackChain();
    const prefixes = new Set(chain.map((m) => m.split('/')[0]));
    expect(prefixes.size).toBeGreaterThan(1);
  });

  it('includes the configured model first', () => {
    process.env.NVIDIA_MODEL = 'ag/gemini-3.8-flash';
    expect(getModelFallbackChain()[0]).toBe('ag/gemini-3.8-flash');
  });
});
