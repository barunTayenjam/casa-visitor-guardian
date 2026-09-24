import { apiGet } from './baseClient';

export interface DailyTotals {
  total: number;
  persons: number;
  faces: number;
  known_faces: number;
  unknown_faces: number;
  first_event: string | null;
  last_event: string | null;
  total_persons: number;
  max_persons_per_event: number;
}

export interface TypeCount {
  event_type: string;
  count: number;
  avg_conf: number;
}

export interface CameraCount {
  camera_id: string;
  count: number;
  persons: number;
}

export interface HourlyTypeRow {
  hour: number;
  event_type: string;
  count: number;
}

export interface HourlyThreatRow {
  hour: number;
  level: string | null;
  count: number;
}

export interface ObjectClassCount {
  obj_class: string;
  count: number;
  avg_conf: number;
}

export interface TrackStateCount {
  state: string;
  count: number;
}

export interface SeverityThreatRow {
  severity: string;
  threat_level: string | null;
  count: number;
}

export interface BurstRow {
  bucket: string;
  count: number;
}

export interface ConfidenceStat {
  event_type: string;
  avg: number;
  min: number;
  max: number;
}

export interface GapRow {
  from_time: string;
  gap_minutes: number;
}

export interface SceneContextRow {
  weather: string | null;
  tod: string | null;
  count: number;
}

export interface UniqueTrackRow {
  camera_id: string;
  unique_tracks: number;
}

export interface CameraHourRow {
  camera_id: string;
  hour: number;
  count: number;
}

export interface WeekBaseline {
  avg_daily_events: number;
  min_day: number;
  max_day: number;
}

export interface NotableEvent {
  id: string;
  timestamp: string;
  event_type: string;
  camera_id: string | null;
  severity: string;
  threat_level: string | null;
  persons_detected: number;
  known_faces: number;
  unknown_faces: number;
}

export interface DailyInsights {
  date: string;
  totals: DailyTotals;
  byType: TypeCount[];
  byCamera: CameraCount[];
  hourlyByType: HourlyTypeRow[];
  hourlyByThreat: HourlyThreatRow[];
  objectClasses: ObjectClassCount[];
  trackStates: TrackStateCount[];
  severityVsThreat: SeverityThreatRow[];
  bursts: BurstRow[];
  confidence: ConfidenceStat[];
  gaps: GapRow[];
  sceneContext: SceneContextRow[];
  uniqueTracks: UniqueTrackRow[];
  cameraHourly: CameraHourRow[];
  weekBaseline: WeekBaseline;
  recentHighThreat: NotableEvent[];
}

interface InsightsEnvelope {
  success: boolean;
  date: string;
  totals: DailyTotals;
  byType: TypeCount[];
  byCamera: CameraCount[];
  hourlyByType: HourlyTypeRow[];
  hourlyByThreat: HourlyThreatRow[];
  objectClasses: ObjectClassCount[];
  trackStates: TrackStateCount[];
  severityVsThreat: SeverityThreatRow[];
  bursts: BurstRow[];
  confidence: ConfidenceStat[];
  gaps: GapRow[];
  sceneContext: SceneContextRow[];
  uniqueTracks: UniqueTrackRow[];
  cameraHourly: CameraHourRow[];
  weekBaseline: WeekBaseline;
  recentHighThreat: NotableEvent[];
}

export async function fetchDailyInsights(date: string): Promise<DailyInsights> {
  const json = await apiGet<InsightsEnvelope>(`/analytics/daily/${date}`);
  if (!json.success) throw new Error('Failed to load daily insights');
  return {
    date: json.date,
    totals: json.totals,
    byType: json.byType,
    byCamera: json.byCamera,
    hourlyByType: json.hourlyByType,
    hourlyByThreat: json.hourlyByThreat,
    objectClasses: json.objectClasses,
    trackStates: json.trackStates,
    severityVsThreat: json.severityVsThreat,
    bursts: json.bursts,
    confidence: json.confidence,
    gaps: json.gaps,
    sceneContext: json.sceneContext,
    uniqueTracks: json.uniqueTracks ?? [],
    cameraHourly: json.cameraHourly ?? [],
    weekBaseline: json.weekBaseline ?? { avg_daily_events: 0, min_day: 0, max_day: 0 },
    recentHighThreat: json.recentHighThreat ?? [],
  };
}
