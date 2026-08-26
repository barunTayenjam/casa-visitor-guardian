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
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseUrl = process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';

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

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `NVIDIA API error: ${response.status} - ${errorData.message || response.statusText}`,
        );
      }

      return await response.json();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 3) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('NVIDIA API call failed after 3 retries');
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
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY environment variable is not set');
  const baseUrl = process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const model = process.env.NVIDIA_MODEL || 'gemini/gemini-3.5-flash-lite';

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

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty NVIDIA reply');
  return content;
}
