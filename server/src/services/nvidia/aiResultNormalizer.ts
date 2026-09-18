import type { NvidianalysisResult } from './types.js';

export interface NormalizedAnalysisResult {
  sceneDescription: string;
  sceneContext: Record<string, unknown> | null;
  summary: string;
  persons: unknown[];
  vehicles: unknown[];
  activities: unknown[];
  overall_summary: string;
  threatAssessment: {
    level: string;
    factors: string[];
    confidence: number;
  };
  detectedEntities: {
    people: unknown[];
    vehicles: unknown[];
    animals: unknown[];
    objects: unknown[];
    actions: unknown[];
  };
  recommendedActions: unknown[];
  additionalObservations: unknown[];
  processing_time_ms: number;
  model: string;
}

export class AIResultNormalizer {
  normalizeNvidiaResult(raw: NvidianalysisResult): NormalizedAnalysisResult {
    const rawDesc = raw.sceneDescription || (raw as any).overall_summary || (raw as any).summary || '';
    const normalizedDesc = this.normalizeSceneDescription(rawDesc);

    return {
      sceneDescription: normalizedDesc,
      sceneContext: (raw.sceneContext as Record<string, unknown>) || null,
      summary: normalizedDesc,
      persons: (raw as any).detectedEntities?.people || (raw as any).persons || [],
      vehicles: (raw as any).detectedEntities?.vehicles || (raw as any).vehicles || [],
      activities: (raw as any).detectedEntities?.actions || (raw as any).activities || [],
      overall_summary: normalizedDesc,
      threatAssessment: raw.threatAssessment || { level: 'low', factors: [], confidence: 0 },
      detectedEntities: raw.detectedEntities || {
        people: [],
        vehicles: [],
        animals: [],
        objects: [],
        actions: [],
      },
      recommendedActions: raw.recommendedActions || [],
      additionalObservations: raw.additionalObservations || [],
      processing_time_ms: (raw as any).processingTime || 0,
      model: (raw as any).modelUsed || 'nvidia',
    };
  }

  normalizeSceneDescription(text: string): string {
    if (typeof text !== 'string' || !text) return '';
    const trimmed = text.trim();

    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return (
          parsed.scene_description ||
          parsed.sceneDescription ||
          parsed.description ||
          parsed.summary ||
          parsed.overall_summary ||
          text
        );
      } catch {
        try {
          const match = trimmed.match(/"scene_description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (match) return match[1];
        } catch {
          /* fall through to raw text */
        }
      }
    }

    return text;
  }

  normalizeSceneDescriptionFromDb(text: string): string {
    return this.normalizeSceneDescription(text);
  }
}

export const aiResultNormalizer = new AIResultNormalizer();
