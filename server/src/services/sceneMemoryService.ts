import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { AppDataSource } from '../database.js';
import { logger } from '../utils/logger.js';
import { serviceRegistry } from './serviceRegistry.js';

/**
 * Scene memory: learns each camera's "normal" scene in calm windows
 * (night hours, low system load, no recent events for the camera) using the
 * local Ollama VLM, then flags detection events that deviate from the
 * baseline. LLM runs ONLY during calm-window sampling — never at event time.
 */

interface SceneMemoryRow {
  id: string;
  camera_id: string;
  time_slot: string;
  baseline_caption: string | null;
  baseline_fingerprint: Record<string, number> | null;
  baseline_objects: Record<string, number> | null;
  confidence: number;
  sample_count: number;
  updated_at: Date;
}

const SCENE_PROMPT = `You are a security camera analyzer. Analyze this image. Output ONLY one JSON object (no markdown fence, no prose):

{"scene_description":"one neutral sentence on environment, lighting, layout",
 "scene_context":{"environment":"indoor|outdoor|unknown","lighting":"string","timeOfDay":"string"},
 "object_counts":{"person":0,"car":0}}

Rules:
- object_counts: visible object counts using detector class names only (person, bicycle, car, motorcycle, bus, truck, dog, cat, bird). Omit zero counts. Omit the key entirely if nothing is visible.
- Describe only what is visible. Clinical tone.
- People: clothing color only in scene_description, no identity guesses.
- Do NOT output bounding boxes.
- Output ONLY the JSON object.`;

export function isSceneMemoryEnabled(): boolean {
  return process.env.SCENE_MEMORY_ENABLED === 'true' && !!process.env.SCENE_MEMORY_LLM_URL;
}

export function timeSlotFor(date = new Date()): 'day' | 'night' {
  const h = date.getHours();
  return h >= 6 && h < 18 ? 'day' : 'night';
}

export function isCalmWindow(now = new Date()): boolean {
  const h = now.getHours();
  return h >= 1 && h < 5;
}

export function isSystemQuiet(): boolean {
  const threshold = parseFloat(process.env.SCENE_MEMORY_LOAD_THRESHOLD || '6');
  return os.loadavg()[0] < threshold;
}

async function cameraIsCalm(cameraId: string): Promise<boolean> {
  const repo = AppDataSource.getRepository(Event);
  const recent = await repo
    .createQueryBuilder('e')
    .where('e.camera_id = :cameraId', { cameraId })
    .andWhere('e.timestamp > NOW() - INTERVAL \'10 minutes\'')
    .getCount();
  return recent === 0;
}

async function llmCaptionFrame(
  frame: Buffer,
): Promise<{ caption: string; counts: Record<string, number> } | null> {
  const url = process.env.SCENE_MEMORY_LLM_URL!;
  const model = process.env.SCENE_MEMORY_MODEL || 'gemma3:4b';
  const timeoutMs = parseInt(process.env.SCENE_MEMORY_TIMEOUT_MS || '240000', 10);

  const buffer = await sharp(frame)
    .resize({ width: 640, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: SCENE_PROMPT, images: [buffer.toString('base64')] },
        ],
        stream: false,
        think: false,
        options: { temperature: 0.1, num_predict: 400 },
        keep_alive: 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const json = (await res.json()) as { message?: { content?: string } };
    const text = json.message?.content || '';
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    const parsed = JSON.parse(text.slice(s, e + 1));
    return { caption: parsed.scene_description || '', counts: objectCountsFrom(parsed.object_counts) };
  } catch (err) {
    logger.warn(`Scene memory LLM call failed: ${err}`, 'SceneMemory');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function objectCountsFrom(raw: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries((raw as Record<string, unknown>) || {})) {
    const n = typeof v === 'number' && v > 0 ? Math.round(v) : 0;
    if (n > 0) counts[k] = n;
  }
  return counts;
}

async function fingerprintOfFrame(frame: Buffer): Promise<Record<string, number> | null> {
  try {
    const stats = await sharp(frame).stats();
    const [r, g, b] = stats.channels.map((c) => c.mean);
    return {
      mean_luma: Math.round((0.299 * r + 0.587 * g + 0.114 * b) * 10) / 10,
      mean_r: Math.round(r),
      mean_g: Math.round(g),
      mean_b: Math.round(b),
    };
  } catch {
    return null;
  }
}

export async function sampleCamera(cameraId: string): Promise<boolean> {
  if (!isSceneMemoryEnabled()) return false;
  if (!isCalmWindow() || !isSystemQuiet()) return false;
  if (!(await cameraIsCalm(cameraId))) return false;

  const streamManager = serviceRegistry.getStreamManager();
  const frame = streamManager.getLastFrame(cameraId);
  if (!frame) {
    logger.warn(`Scene memory: no live frame for ${cameraId}`, 'SceneMemory');
    return false;
  }

  const caption = await llmCaptionFrame(frame);
  if (!caption) return false;
  const fingerprint = await fingerprintOfFrame(frame);
  if (!fingerprint) return false;

  const objects = caption.counts;
  const slot = timeSlotFor();
  await AppDataSource.query(
    `INSERT INTO scene_memory (camera_id, time_slot, baseline_caption, baseline_fingerprint, baseline_objects, confidence, sample_count)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 0.5, 1)
     ON CONFLICT (camera_id, time_slot) DO UPDATE SET
       baseline_caption = EXCLUDED.baseline_caption,
       baseline_fingerprint = EXCLUDED.baseline_fingerprint,
       baseline_objects = (
         CASE WHEN scene_memory.sample_count < 3
           THEN EXCLUDED.baseline_objects
           ELSE scene_memory.baseline_objects END
       ),
       confidence = LEAST(1.0, scene_memory.confidence + 0.25),
       sample_count = scene_memory.sample_count + 1,
       updated_at = NOW()`,
    [cameraId, slot, caption.caption, JSON.stringify(fingerprint), JSON.stringify(objects)],
  );
  logger.info(`Scene memory sampled ${cameraId}/${slot}`, 'SceneMemory');
  return true;
}

export async function sampleAllCalmCameras(): Promise<void> {
  if (!isSceneMemoryEnabled() || !isCalmWindow() || !isSystemQuiet()) return;
  try {
    const cameras = await serviceRegistry.getStreamManager().getAllCameras();
    for (const cam of cameras) {
      if (!cam?.id) continue;
      await sampleCamera(cam.id);
    }
  } catch (err) {
    logger.warn(`Scene memory sampling round failed: ${err}`, 'SceneMemory');
  }
}

/**
 * Compare an event's object inventory (YOLO, no LLM) against the camera's
 * learned baseline. Returns a scene_change flag or null.
 */
export async function compareEventToBaseline(
  cameraId: string,
  eventTs: Date,
  objectDetections: Array<{ class: string }>,
  imagePath?: string | null,
): Promise<{ score: number; what: string[]; baseline_ts: string } | null> {
  try {
    const rows = (await AppDataSource.query(
      `SELECT * FROM scene_memory WHERE camera_id = $1 AND time_slot = $2 LIMIT 1`,
      [cameraId, timeSlotFor(eventTs)],
    )) as SceneMemoryRow[];
    const baseline = rows[0];
    if (!baseline || baseline.sample_count < 3 || baseline.confidence < 0.5) return null;
    if (!baseline.baseline_objects || Object.keys(baseline.baseline_objects).length === 0) return null;

    const eventCounts: Record<string, number> = {};
    for (const d of objectDetections || []) {
      eventCounts[d.class] = (eventCounts[d.class] ?? 0) + 1;
    }

    // Inventory overlap (counts): Σmin / Σmax over union of classes
    const classes = new Set([...Object.keys(eventCounts), ...Object.keys(baseline.baseline_objects)]);
    let sumMin = 0;
    let sumMax = 0;
    const what: string[] = [];
    for (const c of classes) {
      const now = eventCounts[c] ?? 0;
      const base = baseline.baseline_objects[c] ?? 0;
      sumMin += Math.min(now, base);
      sumMax += Math.max(now, base);
      if (now > base) what.push(`new: ${c}${now - base > 1 ? ` x${now - base}` : ''}`);
      if (base > now && now === 0) what.push(`missing: ${c}`);
    }
    if (sumMax === 0) return null;
    const inventoryScore = 1 - sumMin / sumMax;

    // Lighting delta (cheap, no LLM)
    let lumaScore = 0;
    if (baseline.baseline_fingerprint?.mean_luma != null && imagePath) {
      try {
        const abs = imagePath.startsWith('/') ? imagePath : path.join(process.cwd(), imagePath);
        if (fs.existsSync(abs)) {
          const stats = await sharp(abs).stats();
          const [r, g, b] = stats.channels.map((ch) => ch.mean);
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          lumaScore = Math.min(1, Math.abs(luma - baseline.baseline_fingerprint.mean_luma) / 128);
        }
      } catch {
        /* image unreadable — skip lighting component */
      }
    }

    const score = Math.round((0.7 * inventoryScore + 0.3 * lumaScore) * 100) / 100;
    if (score > 0.5) {
      return { score, what: what.slice(0, 5), baseline_ts: new Date(baseline.updated_at).toISOString() };
    }
    return null;
  } catch (err) {
    logger.warn(`Scene memory compare failed: ${err}`, 'SceneMemory');
    return null;
  }
}

/** User-triggered reset of a camera's learned baseline. */
export async function resetBaseline(cameraId: string): Promise<void> {
  await AppDataSource.query(`DELETE FROM scene_memory WHERE camera_id = $1`, [cameraId]);
}
