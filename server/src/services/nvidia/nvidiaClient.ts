import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../../utils/logger.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import type { AnalysisContext, NormalizedDetection } from './types.js';

const nvidiaBreaker = new CircuitBreaker('NvidiaService', {
  failureThreshold: 5,
  cooldownMs: 30000,
  successThreshold: 2,
});

/**
 * Ordered fallback chain — first model that answers wins.
 *
 * The chain deliberately spans independent provider prefixes (`glm/`, `ag/`,
 * `ollama-local/`). A router outage or exhausted quota on one provider must not
 * take analysis down when another prefix can still serve the request.
 */
const VISION_FALLBACK_MODELS = [
  'ag/gemini-3.8-flash',
  'oc/mimo-v2.6-flash-free',
  'openrouter/openrouter/free',
];

export function getEffectiveModel(requested?: string): string {
  if (requested) return requested;
  if (process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL) {
    return process.env.OLLAMA_MODEL;
  }
  return process.env.NVIDIA_MODEL || VISION_FALLBACK_MODELS[0];
}

export function getModelFallbackChain(): string[] {
  if (process.env.OLLAMA_BASE_URL) return [getEffectiveModel()];
  const primary = getEffectiveModel();
  return [primary, ...VISION_FALLBACK_MODELS.filter((m) => m !== primary)];
}

/**
 * Resolve the LLM API base URL. When OLLAMA_BASE_URL is set (local on-device
 * inference), it wins and never falls back to cloud endpoints. Otherwise the
 * NVIDIA-compatible endpoint is required and fails fast — requests carry
 * NVIDIA_API_KEY and must never leak to the cloud when the local endpoint is
 * intended.
 */
export function getNvidiaBaseUrl(): string {
  const ollama = process.env.OLLAMA_BASE_URL;
  if (ollama) {
    return ollama.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1';
  }
  const baseUrl = process.env.NVIDIA_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NVIDIA_API_BASE_URL environment variable is not set');
  }
  return baseUrl;
}

/**
 * Parse JSON from an LLM response, stripping SSE `data: [DONE]` terminator
 * that some proxies append even on non-streaming requests.
 */
async function parseLlmResponse(response: Response): Promise<any> {
  const raw = await response.text();
  const cleaned = raw.replace(/data:\s*\[DONE\]\s*$/, '').trim();
  return JSON.parse(cleaned);
}

const MAX_ATTEMPTS_PER_MODEL = 2;
const MAX_BACKOFF_MS = 5000;

/**
 * Statuses worth trying again or moving past: the upstream provider is
 * overloaded, rate limiting, or timing out. A 4xx like 400/401/403 means the
 * request itself is wrong — retrying it on another model would fail identically,
 * so those abort the chain immediately.
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function backoffDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const headerSeconds = Number(retryAfterHeader);
  if (retryAfterHeader && Number.isFinite(headerSeconds) && headerSeconds > 0) {
    return Math.min(headerSeconds * 1000, MAX_BACKOFF_MS);
  }
  return Math.min(1000 * attempt + Math.random() * 500, MAX_BACKOFF_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeEntityArray(input: unknown, type: string): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const parts: string[] = [];
        if (obj.description) parts.push(String(obj.description));
        if (obj.count !== undefined) parts.push(`count:${obj.count}`);
        if (obj.type) parts.push(String(obj.type));
        if (obj.color) parts.push(String(obj.color));
        if (obj.location) parts.push(String(obj.location));
        if (obj.state || obj.behavior) parts.push(String(obj.state || obj.behavior));
        if (obj.clothing) parts.push(String(obj.clothing));
        if (obj.significance) parts.push(String(obj.significance));
        return parts.length > 0 ? parts.join(' | ') : type;
      }
      return String(item);
    });
  }
  return [];
}

export function imageToBase64(imagePath: string): string {
  const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);

  const imageBuffer = fs.readFileSync(absolutePath);
  return imageBuffer.toString('base64');
}

export async function callNvidiaApi(
  base64Image: string,
  context: AnalysisContext,
  model: string,
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<any> {
  const apiKey = process.env.NVIDIA_API_KEY || (process.env.OLLAMA_BASE_URL ? 'ollama-local' : '');
  const baseUrl = getNvidiaBaseUrl();

  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY environment variable is not set');
  }

  const yoloInfo = context.yoloDetections?.length
    ? `YOLO Detections (local detector, pixel coordinates in the original camera frame): ${context.yoloDetections.map((d) => `${d.class} (${Math.round(d.confidence * 100)}%) @ [${d.bbox.x.toFixed(2)},${d.bbox.y.toFixed(2)},${d.bbox.width.toFixed(2)},${d.bbox.height.toFixed(2)}]`).join('; ')}`
    : null;

  const meta = context.sensorMetadata;
  const sensorLines: string[] = [];
  if (meta?.tracks?.length) {
    const trackLine = (t: (typeof meta.tracks)[number]) => {
      const parts = [
        `${t.class}${t.confidence != null ? ` ${Math.round(t.confidence * 100)}%` : ''}`,
        t.trackId != null ? `track#${t.trackId}` : null,
        t.trackState ?? null,
        t.trackletLen != null ? `${t.trackletLen} frames` : null,
        t.identity && t.identity !== 'unknown'
          ? `identity=${t.identity}${t.identityConfidence != null ? ` (${Math.round(t.identityConfidence * 100)}%)` : ''}`
          : null,
        t.humanVerified != null
          ? `human-check=${t.verificationTier ?? (t.humanVerified ? 'verified' : 'unverified')}`
          : null,
        t.personAttributes?.clothing ? `wearing ${t.personAttributes.clothing}` : null,
        t.personAttributes?.positionPct
          ? `at x=${t.personAttributes.positionPct.x.toFixed(1)}% y=${t.personAttributes.positionPct.y.toFixed(1)}% w=${t.personAttributes.positionPct.width.toFixed(1)}% h=${t.personAttributes.positionPct.height.toFixed(1)}%`
          : null,
        t.personAttributes?.distance ?? null,
        t.personAttributes?.carryingItem && t.personAttributes.carryingItem !== 'none'
          ? `carrying ${t.personAttributes.carryingItem}`
          : null,
        t.personAttributes?.bodyLanguage ?? null,
        t.personAttributes?.actions?.length ? t.personAttributes.actions.join('/') : null,
      ].filter(Boolean);
      return parts.join(', ');
    };
    sensorLines.push(`Tracked objects (local pipeline, supporting data): ${meta.tracks.map(trackLine).join(' | ')}`);
  }
  if (meta?.localThreat?.level) {
    sensorLines.push(
      `Local threat detector: ${meta.localThreat.level}${meta.localThreat.factors?.length ? ` (${meta.localThreat.factors.slice(0, 3).join('; ')})` : ''}`,
    );
  }
  if (meta?.sceneContext && Object.keys(meta.sceneContext).length) {
    sensorLines.push(
      `Local scene analysis: ${Object.entries(meta.sceneContext)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(', ')}`,
    );
  }
  if (meta?.motionStats) {
    sensorLines.push(
      `Motion signal: ${meta.motionStats.motion_percentage ?? 0}% of frame changed (confidence ${meta.motionStats.confidence ?? 0})`,
    );
  }

  const contextInfo = [
    context.cameraName ? `Camera: ${context.cameraName}` : null,
    context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
    context.eventType ? `Event Type: ${context.eventType}` : null,
    context.detectedObjects?.length
      ? `Detected Objects: ${context.detectedObjects.join(', ')}`
      : null,
    yoloInfo,
    context.timestamp ? `Timestamp: ${context.timestamp}` : null,
    ...sensorLines,
  ]
    .filter(Boolean)
    .join(' | ');

  const userMessage = contextInfo
    ? `Context: ${contextInfo}\n\nThe image is your primary evidence — analyze it directly. The sensor metadata above (tracked objects, local threat/scene/motion) is supporting context from local detectors that can miss objects or misclassify them, and the image is downscaled so small/distant objects may be hard to see. Use the metadata as hints: it can tell you about objects too small to see, but verify against the image whenever visible and trust your own visual analysis when they conflict. Note discrepancies in your observations. Respond with only valid JSON: {`
    : 'Analyze this image. Respond with only valid JSON: {';

  const requestBody = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessage,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    temperature: 0.0,
    max_tokens: 4096,
    stream: false,
    top_p: 0.9,
  };

  const fallbackModels = getModelFallbackChain();
  const errors: string[] = [];

  for (const fallbackModel of fallbackModels) {
    let lastError: Error | null = null;
    let advanceChain = false;
    requestBody.model = fallbackModel;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const response = await nvidiaBreaker.execute(() =>
          fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal,
          }),
        );

        if (response.status === 404) {
          logger.warn(
            `Model ${fallbackModel} not found (404), trying next fallback`,
            'NvidiaClient',
          );
          lastError = new Error(`Model ${fallbackModel} not found`);
          advanceChain = true;
          break;
        }

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            message?: string;
            error?: { message?: string };
          };
          const detail =
            errorData.error?.message || errorData.message || response.statusText || 'unknown';
          const err = new Error(`NVIDIA API error: ${response.status} - ${detail}`);

          if (!isRetryableStatus(response.status)) {
            errors.push(`${fallbackModel}: ${err.message}`);
            throw err;
          }

          lastError = err;
          advanceChain = true;
          if (attempt < MAX_ATTEMPTS_PER_MODEL) {
            await sleep(backoffDelayMs(attempt, response.headers.get('retry-after')));
            continue;
          }
          break;
        }

        if (lastError) {
          logger.info(
            `Model ${fallbackModel} recovered on attempt ${attempt} after a retryable failure`,
            'NvidiaClient',
          );
        }
        return await parseLlmResponse(response);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') throw err;

        const normalized = err instanceof Error ? err : new Error(String(err));
        if (errors.some((e) => e.endsWith(normalized.message))) throw normalized;

        lastError = normalized;
        advanceChain = true;
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          await sleep(backoffDelayMs(attempt, null));
        }
      }
    }

    if (lastError) errors.push(`${fallbackModel}: ${lastError.message}`);

    if (lastError && !advanceChain) throw lastError;
    if (lastError) {
      logger.warn(
        `Model ${fallbackModel} failed (${lastError.message}), advancing to next fallback`,
        'NvidiaClient',
      );
    }
  }

  throw new Error(
    `NVIDIA API call failed: all ${fallbackModels.length} fallback models exhausted — ${errors.join('; ')}`,
  );
}

export function getNvidiaBreakerState(): string {
  return nvidiaBreaker.getState();
}

export interface ChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Text-only chat completion on the same NVIDIA endpoint, key, model, and
 * circuit breaker as the vision analysis calls. Shared so every LLM path in
 * the app fails and recovers together.
 */
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  opts: ChatCompletionOptions = {},
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY || (process.env.OLLAMA_BASE_URL ? 'ollama-local' : '');
  if (!apiKey) throw new Error('NVIDIA_API_KEY environment variable is not set');
  const baseUrl = getNvidiaBaseUrl();
  const model = getEffectiveModel();

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? 1200,
    stream: false,
  };

  const response = await nvidiaBreaker.execute(() =>
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
      `NVIDIA API error: ${response.status} - ${(errorData as Record<string, unknown>).message || response.statusText}`,
    );
  }

  const json = (await parseLlmResponse(response)) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty NVIDIA reply');
  return content;
}
