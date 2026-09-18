import { AppDataSource } from '../../../database.js';
import type { QueryHandler, QueryResult } from '../queryHandler.js';
import type { VehicleTimelineInput } from '../queryTools.js';
import { resolveVehicleClasses, clusterSessions, fmtIstTime, SESSION_GAP_MS, CONFIDENCE_FLOOR } from '../queryTools.js';

export class VehicleTimelineQuery implements QueryHandler<VehicleTimelineInput> {
  name = 'vehicleTimeline';

  async execute(params: VehicleTimelineInput): Promise<QueryResult> {
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

    const sessions = clusterSessions(
      rows.map((r) => ({
        camera: String(r.camera_id ?? '?'),
        first: new Date(r.first_seen as Date),
        last: new Date(r.last_seen as Date),
        obs: Number(r.obs),
      })),
    );

    const eventRows = (await AppDataSource.query(
      `SELECT ed.event_id, e.file_path, ed.camera_id,
              MAX(ed.confidence) AS conf, MIN(ed.timestamp) AS ts
       FROM event_detections ed
       JOIN events e ON e.id = ed.event_id
       WHERE ed.class = ANY($1)
         AND ed.timestamp >= $2 AND ed.timestamp < $3 AND ed.confidence >= $4
         AND e.file_path IS NOT NULL
         ${cameraCond}
       GROUP BY 1, 2, 3`,
      values,
    )) as Array<Record<string, unknown>>;

    const candidates = eventRows.map((r) => ({
      camera: String(r.camera_id ?? '?'),
      file: String(r.file_path ?? '').split('/').pop() ?? '',
      conf: Number(r.conf),
      ts: new Date(r.ts as Date),
    }));

    const images: import('../../../types/chat.js').ChatImage[] = [];
    for (const [i, s] of sessions.slice(0, 6).entries()) {
      const inVisit = candidates.filter(
        (c) => c.camera === s.camera && c.ts >= s.first && c.ts.getTime() <= s.last.getTime() + 60_000,
      );
      const best = inVisit.sort((a, b) => b.conf - a.conf)[0];
      if (best?.file) {
        images.push({
          url: `/api/events/image/${best.file}`,
          caption: `Visit ${i + 1} · ${s.camera} · ${fmtIstTime(s.first)}`,
        });
      }
    }

    const detections = rows.reduce((a, r) => a + Number(r.obs), 0);
    const events = rows.reduce((a, r) => a + Number(r.events), 0);
    const cameras = [...new Set(rows.map((r) => String(r.camera_id ?? '')).filter(Boolean))];

    return {
      tables: [
        {
          caption: `${params.vehicle} visits (track fragments merged; gaps > ${Math.round(SESSION_GAP_MS / 60000)} min split visits)`,
          headers: ['Camera', 'Visit', 'From (IST)', 'Until (IST)', 'Track fragments', 'Observations'],
          rows: sessions.map((s: { camera: string; first: Date; last: Date; trackCount: number; obs: number }, i: number) => [
            s.camera,
            i + 1,
            fmtIstTime(s.first),
            fmtIstTime(s.last),
            s.trackCount,
            s.obs,
          ]),
        },
      ],
      evidence: { detections, events, cameras, sessions: sessions.length, tracks: rows.length },
      images,
    };
  }
}
