import { z } from 'zod';
import { AppDataSource } from '../../database.js';
import { rangeTokenSchema } from './dateResolver.js';

// Class vocabulary is stock COCO. User-facing vehicle names alias onto it.
export const ALIAS_MAP: Record<string, string[]> = {
  scooter: ['motorcycle'],
  bike: ['motorcycle'],
  motorcycle: ['motorcycle'],
  suv: ['car'],
  car: ['car'],
  sedan: ['car'],
  truck: ['truck'],
  lorry: ['truck'],
  bus: ['bus'],
  bicycle: ['bicycle'],
  cycle: ['bicycle'],
};
export const VEHICLE_GROUP = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'];
export const CONFIDENCE_FLOOR = 0.4;
export const IST = 'Asia/Kolkata';

const rangeSchema = z.union([
  rangeTokenSchema,
  z.object({ from: z.string(), to: z.string() }),
]);

export const vehicleTimelineParamsSchema = z.object({
  vehicle: z.string(),
  range: rangeSchema,
  camera: z.string().nullable().optional(),
});

export const humanCountsParamsSchema = z.object({
  range: rangeSchema,
  camera: z.string().nullable().optional(),
  hour_from: z.number().int().min(0).max(23).optional(),
  hour_to: z.number().int().min(1).max(24).optional(),
});

export const periodReportParamsSchema = z.object({
  range: rangeSchema,
  camera: z.string().nullable().optional(),
});

export type VehicleTimelineParams = z.infer<typeof vehicleTimelineParamsSchema>;
export type HumanCountsParams = z.infer<typeof humanCountsParamsSchema>;
export type PeriodReportParams = z.infer<typeof periodReportParamsSchema>;

export interface VehicleTimelineInput {
  vehicle: string;
  camera?: string | null;
  from: Date;
  to: Date;
}

export interface HumanCountsInput {
  camera?: string | null;
  from: Date;
  to: Date;
  hour_from?: number;
  hour_to?: number;
}

export function resolveVehicleClasses(vehicle: string): string[] {
  const key = vehicle.trim().toLowerCase();
  if (key === 'vehicle' || key === 'vehicles' || key === 'any') return [...VEHICLE_GROUP];
  const mapped = ALIAS_MAP[key];
  return mapped ?? [];
}

/** Pure classification shared with the unit test. */
export function classifyTrack(
  firstState: string | null,
  lastState: string | null,
): 'returned' | 'left' | 'observed' {
  if (lastState === 'ended' || lastState === 'lost') return 'left';
  if (firstState === 'started') return 'returned';
  return 'observed';
}

export function fmtIstTime(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleString('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export async function vehicleTimeline(
  params: VehicleTimelineInput,
): Promise<{
  tables: import('../../types/chat.js').ChatTable[];
  evidence: { detections: number; events: number; cameras: string[] };
}> {
  const classes = resolveVehicleClasses(params.vehicle);
  const values: unknown[] = [classes, params.from, params.to, CONFIDENCE_FLOOR];
  let cameraCond = '';
  if (params.camera) {
    values.push(params.camera);
    cameraCond = `AND ed.camera_id = $${values.length}`;
  }

  const rows = await AppDataSource.query(
    `SELECT ed.track_id,
            ed.camera_id,
            MIN(ed.timestamp) AS first_seen,
            MAX(ed.timestamp) AS last_seen,
            (array_agg(ed.track_state ORDER BY ed.timestamp) FILTER (WHERE ed.track_state IS NOT NULL))[1] AS first_state,
            (array_agg(ed.track_state ORDER BY ed.timestamp DESC) FILTER (WHERE ed.track_state IS NOT NULL))[1] AS last_state,
            COUNT(*) AS obs,
            COUNT(DISTINCT ed.event_id) AS events
     FROM event_detections ed
     WHERE ed.class = ANY($1)
       AND ed.timestamp >= $2 AND ed.timestamp < $3
       AND ed.confidence >= $4
       ${cameraCond}
     GROUP BY ed.track_id, ed.camera_id
     ORDER BY first_seen`,
    values,
  ) as Array<Record<string, unknown>>;

  const trackRows = rows.map((r) => {
    const kind = classifyTrack(
      (r.first_state as string) ?? null,
      (r.last_state as string) ?? null,
    );
    const label =
      kind === 'left'
        ? `left at ${fmtIstTime(r.last_seen as Date)}`
        : kind === 'returned'
          ? `seen from ${fmtIstTime(r.first_seen as Date)}`
          : `observed ${fmtIstTime(r.first_seen as Date)}→${fmtIstTime(r.last_seen as Date)}`;
    return {
      camera: (r.camera_id as string) ?? '?',
      track: (r.track_id as number) ?? '?',
      label,
      obs: Number(r.obs),
      events: Number(r.events),
    };
  });

  const detections = rows.reduce((a, r) => a + Number(r.obs), 0);
  const events = rows.reduce((a, r) => a + Number(r.events), 0);
  const cameras = [...new Set(rows.map((r) => String(r.camera_id ?? '')).filter(Boolean))];

  return {
    tables: [
      {
        caption: `${params.vehicle} sightings (${classes.join(', ')})`,
        headers: ['Camera', 'Track', 'Timeline', 'Observations', 'Events'],
        rows: trackRows.map((t) => [t.camera, t.track, t.label, t.obs, t.events]),
      },
    ],
    evidence: { detections, events, cameras },
  };
}

export async function humanCounts(
  params: HumanCountsInput,
): Promise<{
  tables: import('../../types/chat.js').ChatTable[];
  evidence: { detections: number; events: number; cameras: string[] };
}> {
  const values: unknown[] = [params.from, params.to, CONFIDENCE_FLOOR];
  let conds = 'AND ed.confidence >= $3';
  if (params.camera) {
    values.push(params.camera);
    conds += ` AND ed.camera_id = $${values.length}`;
  }
  let hourCond = '';
  if (params.hour_from !== undefined || params.hour_to !== undefined) {
    const from = Math.max(0, params.hour_from ?? 0);
    const to = Math.min(24, params.hour_to ?? 24);
    values.push(from, to);
    hourCond = ` AND extract(hour FROM ed.timestamp AT TIME ZONE '${IST}') >= $${values.length - 1}
                AND extract(hour FROM ed.timestamp AT TIME ZONE '${IST}') < $${values.length}`;
  }

  const rows = await AppDataSource.query(
    `SELECT extract(hour FROM ed.timestamp AT TIME ZONE '${IST}')::int AS hour,
            COUNT(*) AS detections,
            COUNT(DISTINCT (ed.camera_id, ed.track_id)) AS humans,
            COUNT(*) FILTER (WHERE ed.human_verified = true) AS verified,
            COUNT(DISTINCT ed.event_id) AS events
     FROM event_detections ed
     WHERE ed.class = 'person'
       AND ed.timestamp >= $1 AND ed.timestamp < $2
       ${conds}
       ${hourCond}
     GROUP BY 1
     ORDER BY 1`,
    values,
  ) as Array<Record<string, unknown>>;

  const hourRows = rows.map((r) => ({
    hour: Number(r.hour),
    humans: Number(r.humans),
    detections: Number(r.detections),
    verified: Number(r.verified),
    events: Number(r.events),
  }));

  const label = (h: number) => {
    const s = `${String(h % 24).padStart(2, '0')}:00`;
    const e = `${String((h + 1) % 24).padStart(2, '0')}:00`;
    return `${s}–${e}`;
  };

  return {
    tables: [
      {
        caption: 'Humans by hour (IST)',
        headers: ['Hour', 'Unique humans', 'Person detections', 'Verified humans', 'Events'],
        rows: hourRows.map((r) => [label(r.hour), r.humans, r.detections, r.verified, r.events]),
      },
    ],
    evidence: {
      detections: hourRows.reduce((a, r) => a + r.detections, 0),
      events: hourRows.reduce((a, r) => a + r.events, 0),
      cameras: [],
    },
  };
}