import { API_URL, fetchWithRetry } from './baseClient';

export interface PersonAttributes {
  position?: { x: number; y: number; width: number; height: number };
  description?: string;
  clothing?: string;
  clothing_colors?: string[];
  actions?: string[];
  facing?: string;
  distance?: string;
  estimatedAge?: string;
  carryingItem?: string;
  bodyLanguage?: string;
  confidence?: number;
}

export interface DetectionRow {
  id: number;
  eventId: string;
  cameraId: string;
  timestamp: string;
  class: string;
  classId: number | null;
  confidence: number | null;
  bbox: { x: number | null; y: number | null; w: number | null; h: number | null };
  trackId: number | null;
  trackState: string | null;
  trackletLen: number | null;
  identity: string | null;
  identityConfidence: number | null;
  humanVerified: boolean | null;
  verificationTier: string | null;
  personAttributes: PersonAttributes | null;
  embeddingDim: number;
  eventType: string | null;
  filePath: string | null;
  severity: string | null;
  threatLevel: string | null;
  motionStats: { motion_pixels?: number; motion_percentage?: number; confidence?: number } | null;
  sceneContext: Record<string, unknown> | null;
}

export interface DetectionStats {
  byClass: { key: string; count: number }[];
  byTier: { key: string; count: number }[];
  byThreat: { key: string; count: number }[];
  byClothing: { key: string; count: number }[];
  byDistance: { key: string; count: number }[];
  hourly: { key: string; count: number }[];
  cameras: { key: string; count: number }[];
}

export interface DetectionListParams {
  class?: string;
  camera?: string;
  tier?: string;
  verified?: string;
  threat?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function fetchDetectionRows(params: DetectionListParams): Promise<{
  rows: DetectionRow[];
  total: number;
  page: number;
  limit: number;
}> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  const res = await fetchWithRetry(`${API_URL}/detection-data?${qs.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load detections');
  return json.data;
}

export async function fetchDetectionStats(params: {
  from?: string;
  to?: string;
  camera?: string;
}): Promise<DetectionStats> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, String(v));
  });
  const res = await fetchWithRetry(`${API_URL}/detection-data/stats?${qs.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load stats');
  return json.data;
}

export function detectionImageUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const base = filePath.split('/').pop();
  return base ? `/api/events/image/${base}` : null;
}
