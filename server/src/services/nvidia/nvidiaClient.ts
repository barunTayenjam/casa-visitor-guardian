import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../../utils/logger.js';
import type { AnalysisContext } from './types.js';

export function normalizeEntityArray(input: unknown, type: string): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(item => {
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
  const absolutePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(process.cwd(), imagePath);

  const imageBuffer = fs.readFileSync(absolutePath);
  return imageBuffer.toString('base64');
}

export async function callNvidiaApi(
  base64Image: string,
  context: AnalysisContext,
  model: string,
  systemPrompt: string
): Promise<any> {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY environment variable is not set');
  }

  const contextInfo = [
    context.cameraName ? `Camera: ${context.cameraName}` : null,
    context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
    context.eventType ? `Event Type: ${context.eventType}` : null,
    context.detectedObjects?.length ? `Detected Objects: ${context.detectedObjects.join(', ')}` : null,
    context.timestamp ? `Timestamp: ${context.timestamp}` : null,
  ].filter(Boolean).join(' | ');

  const userMessage = contextInfo
    ? `Context: ${contextInfo}\n\nAnalyze this image carefully. Your response MUST be ONLY valid JSON starting with { and ending with }. No markdown, no code blocks, no preamble. Be specific about counts, colors, positions, and behaviors.`
    : 'Analyze this image carefully. Your response MUST be ONLY valid JSON starting with { and ending with }. No markdown, no code blocks, no preamble. Be specific about counts, colors, positions, and behaviors.';

  const requestBody = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessage
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 4096,
    stream: false,
    top_p: 0.9
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`NVIDIA API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      lastError = err;
      if (attempt < 3) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('NVIDIA API call failed after 3 retries');
}
