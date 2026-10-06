import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';
import { chatCompletion } from './nvidia/nvidiaClient.js';
import type { EventRelation } from '../types/event.js';

export interface RelationThreat {
  level: 'low' | 'medium' | 'high';
  confidence: number;
  reasoning: string;
  factors: string[];
  recommendedActions: string[];
  model?: string;
  assessedAt?: string;
}

export interface RelationThreatResponse {
  eventId: string;
  source: 'cache' | 'computed' | 'skipped';
  reason?: string;
  threat: RelationThreat | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_LEVELS = new Set(['low', 'medium', 'high']);

interface ThreatEventRow {
  id: string;
  camera_id: string | null;
  timestamp: Date;
  event_type: string;
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  unknown_faces_count: number;
  relations: unknown;
}

export function extractJson(raw: string): unknown {
  const stripped = raw.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM response contained no JSON object');
  }
  return JSON.parse(stripped.slice(start, end + 1));
}

export function normalizeThreat(parsed: unknown, model: string): RelationThreat {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('LLM threat response is not an object');
  }
  const p = parsed as Record<string, unknown>;
  const level = String(p.level ?? '').toLowerCase();
  if (!VALID_LEVELS.has(level)) {
    throw new Error(`LLM returned invalid threat level "${level}"`);
  }
  const confidenceRaw = Number(p.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
    : 50;
  const factors = Array.isArray(p.factors)
    ? p.factors.map((f) => String(f)).filter(Boolean).slice(0, 8)
    : [];
  const actions = Array.isArray(p.recommendedActions)
    ? p.recommendedActions.map((a) => String(a)).filter(Boolean).slice(0, 5)
    : [];
  return {
    level: level as RelationThreat['level'],
    confidence,
    reasoning: String(p.reasoning ?? '').slice(0, 600),
    factors,
    recommendedActions: actions,
    model,
    assessedAt: new Date().toISOString(),
  };
}

function buildPrompt(row: ThreatEventRow, relations: EventRelation[], boxes: string[]): string {
  const time = new Date(row.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const relationLines = relations
    .map((r) => `${r.subject} -> ${r.predicate} -> ${r.object} (score ${r.score})`)
    .join('; ');
  return [
    `Camera: ${row.camera_id ?? 'unknown'}`,
    `Time: ${time} IST`,
    `Event type: ${row.event_type}`,
    `Persons detected: ${row.persons_detected}, faces: ${row.faces_detected} (known ${row.known_faces_count}, unknown ${row.unknown_faces_count})`,
    `Objects in frame: ${boxes.join(', ')}`,
    `Grounded scene relations: ${relationLines}`,
    '',
    'Assess the security threat of this event using ONLY the facts above. Do not invent objects or people.',
    'Reply with strict JSON only, no markdown:',
    '{"level":"low|medium|high","confidence":0-100,"reasoning":"at most two sentences","factors":["short factual factors"],"recommendedActions":["short actions"]}',
  ].join('\n');
}

export class RelationThreatService {
  async assessEventThreat(eventId: string): Promise<RelationThreatResponse | null> {
    if (!UUID_PATTERN.test(eventId)) {
      throw new Error('Invalid event id');
    }

    const rows = (await AppDataSource.query(
      `SELECT id, camera_id, timestamp, event_type, persons_detected, faces_detected,
              known_faces_count, unknown_faces_count, relations
       FROM events WHERE id = $1 LIMIT 1`,
      [eventId],
    )) as ThreatEventRow[];
    const event = rows[0];
    if (!event) return null;

    if (event.relations && typeof event.relations === 'object' && !Array.isArray(event.relations)) {
      const doc = event.relations as { threat?: unknown; relations?: unknown };
      if (doc.threat && typeof doc.threat === 'object') {
        return { eventId, source: 'cache', threat: doc.threat as RelationThreat };
      }
      if (!Array.isArray(doc.relations) || doc.relations.length === 0) {
        return {
          eventId,
          source: 'skipped',
          reason: 'event has no scene relations to ground an assessment',
          threat: null,
        };
      }
      const boxes = (event.relations as { boxes?: Array<{ class: string }> }).boxes ?? [];
      return this.compute(eventId, event, doc.relations as EventRelation[], boxes.map((b) => b.class));
    }

    return {
      eventId,
      source: 'skipped',
      reason: 'event has no stored relations document',
      threat: null,
    };
  }

  private async compute(
    eventId: string,
    event: ThreatEventRow,
    relations: EventRelation[],
    boxes: string[],
  ): Promise<RelationThreatResponse> {
    const prompt = buildPrompt(event, relations, boxes);
    const raw = await chatCompletion(
      'You are a home-security analyst. You assess camera events using ONLY the grounded facts provided — never invent objects or people. Respond with strict JSON, no markdown.',
      prompt,
      { temperature: 0, maxTokens: 500 },
    );
    const model = process.env.NVIDIA_MODEL || 'unknown';
    const threat = normalizeThreat(extractJson(raw), model);

    await AppDataSource.query(
      `UPDATE events SET relations = jsonb_set(relations, '{threat}', $1::jsonb, true)
       WHERE id = $2 AND jsonb_typeof(relations) = 'object'`,
      [JSON.stringify(threat), eventId],
    );
    logger.info(
      `RelationThreat: event ${eventId} -> ${threat.level} (${threat.confidence}%)`,
      'RelationThreat',
    );
    return { eventId, source: 'computed', threat };
  }
}

export const relationThreatService = new RelationThreatService();
