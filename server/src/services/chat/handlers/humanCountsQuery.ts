import { AppDataSource } from '../../../database.js';
import type { QueryHandler, QueryResult } from '../queryHandler.js';
import type { HumanCountsInput } from '../queryTools.js';
import { CONFIDENCE_FLOOR, IST, clusterSessions } from '../queryTools.js';

export class HumanCountsQuery implements QueryHandler<HumanCountsInput> {
  name = 'humanCounts';

  async execute(params: HumanCountsInput): Promise<QueryResult> {
    const objectClass = params.objectClass ?? 'person';
    const isPerson = objectClass === 'person';

    const hourValues: unknown[] = [params.from, params.to, CONFIDENCE_FLOOR, [objectClass]];
    let hourConds = 'AND ed.confidence >= $3 AND ed.class = ANY($4)';
    if (params.camera) {
      hourValues.push(params.camera);
      hourConds += ` AND ed.camera_id = $${hourValues.length}`;
    }
    if (params.hour_from !== undefined || params.hour_to !== undefined) {
      const from = Math.max(0, params.hour_from ?? 0);
      const to = Math.min(24, params.hour_to ?? 24);
      hourValues.push(from, to);
      hourConds += ` AND extract(hour FROM ed.timestamp AT TIME ZONE '${IST}') >= $${hourValues.length - 1}
                    AND extract(hour FROM ed.timestamp AT TIME ZONE '${IST}') < $${hourValues.length}`;
    }

    const rows = await AppDataSource.query(
      `SELECT extract(hour FROM ed.timestamp AT TIME ZONE '${IST}')::int AS hour,
              COUNT(*) AS detections,
              COUNT(DISTINCT (ed.camera_id, ed.track_id)) AS humans,
              COUNT(*) FILTER (WHERE ed.human_verified = true) AS verified,
              COUNT(DISTINCT ed.event_id) AS events
       FROM event_detections ed
       WHERE ed.timestamp >= $1 AND ed.timestamp < $2
         ${hourConds}
       GROUP BY 1
       ORDER BY 1`,
      hourValues,
    ) as Array<Record<string, unknown>>;

    const hourRows = rows.map((r) => ({
      hour: Number(r.hour),
      humans: Number(r.humans),
      detections: Number(r.detections),
      verified: Number(r.verified),
      events: Number(r.events),
    }));

    const spanValues: unknown[] = [params.from, params.to, CONFIDENCE_FLOOR, [objectClass]];
    let spanConds = 'AND ed.confidence >= $3 AND ed.class = ANY($4)';
    if (params.camera) {
      spanValues.push(params.camera);
      spanConds += ` AND ed.camera_id = $${spanValues.length}`;
    }
    if (params.hour_from !== undefined || params.hour_to !== undefined) {
      const from = Math.max(0, params.hour_from ?? 0);
      const to = Math.min(24, params.hour_to ?? 24);
      spanValues.push(from, to);
      spanConds += ` AND extract(hour FROM ed.timestamp AT TIME ZONE '${IST}') >= $${spanValues.length - 1}
                    AND extract(hour FROM ed.timestamp AT TIME ZONE '${IST}') < $${spanValues.length}`;
    }
    const spanRows = (await AppDataSource.query(
      `SELECT ed.camera_id,
              ed.track_id,
              MIN(ed.timestamp) AS first_seen,
              MAX(ed.timestamp) AS last_seen,
              COUNT(*) AS obs
       FROM event_detections ed
       WHERE ed.timestamp >= $1 AND ed.timestamp < $2
         ${spanConds}
       GROUP BY 1, 2`,
      spanValues,
    )) as Array<Record<string, unknown>>;

    const trackSpans = spanRows
      .filter((r) => r.track_id !== null)
      .map((r) => ({
        camera: String(r.camera_id ?? '?'),
        first: new Date(r.first_seen as Date),
        last: new Date(r.last_seen as Date),
        obs: Number(r.obs),
      }));
    const sessions = clusterSessions(trackSpans);

    const label = (h: number) => {
      const s = `${String(h % 24).padStart(2, '0')}:00`;
      const e = `${String((h + 1) % 24).padStart(2, '0')}:00`;
      return `${s}–${e}`;
    };
    const classLabel = isPerson ? 'Humans' : `${objectClass}s`;
    const uniqueHeader = isPerson ? 'Unique humans' : 'Unique tracks';
    const verifiedHeader = isPerson ? 'Verified humans' : 'Verified';

    return {
      tables: [
        {
          caption: `${classLabel} by hour (IST)`,
          headers: ['Hour', uniqueHeader, `${objectClass} detections`, verifiedHeader, 'Events'],
          rows: hourRows.map((r) => [label(r.hour), r.humans, r.detections, r.verified, r.events]),
        },
      ],
      evidence: {
        detections: hourRows.reduce((a, r) => a + r.detections, 0),
        events: hourRows.reduce((a, r) => a + r.events, 0),
        cameras: [],
        sessions: sessions.length,
        tracks: trackSpans.length,
      },
    };
  }
}
