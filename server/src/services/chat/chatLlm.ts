import { logger } from '../../utils/logger.js';
import { chatCompletion } from '../nvidia/nvidiaClient.js';

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
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await chatCompletion(systemPrompt, userPrompt, {
        maxTokens: opts.maxTokens ?? 1200,
      });
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
    }
  }
  logger.error('chatLlm failed', 'CHAT', lastError);
  throw lastError || new Error('LLM call failed');
}
