import { CircuitBreaker } from '../circuitBreaker.js';
import { logger } from '../../utils/logger.js';

const chatBreaker = new CircuitBreaker('ChatLlm', {
  failureThreshold: 5,
  cooldownMs: 30000,
  successThreshold: 2,
});

// Tolerant JSON extraction: find the first balanced {...} block in the reply.
export function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object in LLM reply');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const raw = text.slice(start, i + 1);
        return JSON.parse(raw) as Record<string, unknown>;
      }
    }
  }
  throw new Error('Unbalanced JSON in LLM reply');
}

export async function chatLlm(
  systemPrompt: string,
  userPrompt: string,
  opts: { maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY environment variable is not set');
  const baseUrl = process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const model = process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: opts.maxTokens ?? 1200,
    stream: false,
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await chatBreaker.execute(() =>
        fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        }),
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `LLM API error: ${response.status} - ${(errorData as Record<string, unknown>).message || response.statusText}`,
        );
      }
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty LLM reply');
      return content;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
    }
  }
  logger.error('chatLlm failed', 'CHAT', lastError);
  throw lastError || new Error('LLM call failed');
}