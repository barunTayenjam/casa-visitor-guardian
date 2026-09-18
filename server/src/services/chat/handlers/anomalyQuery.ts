import { AppDataSource } from '../../../database.js';
import type { QueryHandler, QueryResult } from '../queryHandler.js';
import type { AnomaliesInput, DailyCount, AnomalyResult } from '../queryTools.js';
import { CONFIDENCE_FLOOR, IST } from '../queryTools.js';

export function detectDailyAnomalies(
  series: DailyCount[],
  opts: { minSpikeDetections?: number; zThreshold?: number; gapFloor?: number } = {},
): AnomalyResult {
  const { minSpikeDetections = 10, gapFloor = 0 } = opts;
  const byCam = new Map<string, DailyCount[]>();
  for (const r of series) {
    const list = byCam.get(r.camera) ?? [];
    list.push(r);
    byCam.set(r.camera, list);
  }

  const spikes: AnomalyResult['spikes'] = [];
  const gaps: AnomalyResult['gaps'] = [];

  for (const [camera, rows] of byCam) {
    const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
    const counts = sorted.map((r) => r.detections);
    const sum = counts.reduce((a, b) => a + b, 0);
    const sumSq = counts.reduce((a, b) => a + b * b, 0);
    const n = counts.length;

    for (const r of sorted) {
      if (n < 2) continue;
      const exclMean = (sum - r.detections) / (n - 1);
      const exclVar = Math.max(0, (sumSq - r.detections ** 2) / (n - 1) - exclMean ** 2);
      const exclSd = Math.sqrt(exclVar);
      const threshold = Math.max(exclMean * 2, exclMean + 2 * exclSd);
      if (r.detections >= minSpikeDetections && r.detections > exclMean && r.detections >= threshold) {
        spikes.push({
          day: r.day,
          camera,
          detections: r.detections,
          mean: Math.round(exclMean * 10) / 10,
        });
      }
    }

    let runStart = -1;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].detections <= gapFloor) {
        if (runStart === -1) runStart = i;
      } else if (runStart !== -1) {
        gaps.push({
          from: sorted[runStart].day,
          to: sorted[i - 1].day,
          camera,
          days: i - runStart,
        });
        runStart = -1;
      }
    }
    if (runStart !== -1) {
      gaps.push({
        from: sorted[runStart].day,
        to: sorted[sorted.length - 1].day,
        camera,
        days: sorted.length - runStart,
      });
    }
  }

  spikes.sort((a, b) => b.detections - a.detections);
  gaps.sort((a, b) => b.days - a.days);
  return { spikes, gaps };
}

export class AnomalyQuery implements QueryHandler<AnomaliesInput> {
  name = 'anomalies';

  async execute(params: AnomaliesInput): Promise<QueryResult> {
    const values: unknown[] = [params.from, params.to, CONFIDENCE_FLOOR];
    let cameraCond = '';
    if (params.camera) {
      values.push(params.camera);
      cameraCond = `AND ed.camera_id = $${values.length}`;
    }

    const rows = (await AppDataSource.query(
      `SELECT (ed.timestamp AT TIME ZONE '${IST}')::date::text AS day,
              ed.camera_id,
              COUNT(*) AS detections
       FROM event_detections ed
       WHERE ed.timestamp >= $1 AND ed.timestamp < $2 AND ed.confidence >= $3
       ${cameraCond}
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      values,
    )) as Array<Record<string, unknown>>;

    const countRow = (await AppDataSource.query(
      `SELECT COUNT(*) AS detections, COUNT(DISTINCT ed.event_id) AS events
       FROM event_detections ed
       WHERE ed.timestamp >= $1 AND ed.timestamp < $2 AND ed.confidence >= $3
       ${cameraCond}`,
      values,
    )) as Array<Record<string, unknown>>;

    const present = rows.map((r) => ({
      day: r.day as string,
      camera: (r.camera_id as string) ?? '?',
      detections: Number(r.detections),
    }));

    const firstEverRows = (await AppDataSource.query(
      `SELECT camera_id, MIN(timestamp) AS first_ever
       FROM event_detections
       GROUP BY camera_id`,
    )) as Array<Record<string, unknown>>;
    const firstEver = new Map<string, string>();
    for (const r of firstEverRows) {
      firstEver.set(String(r.camera_id), String((r.first_ever as Date).toISOString?.() ?? r.first_ever));
    }
    const windowFromDay = new Date(params.from.getTime() + (5 * 60 + 30) * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const byCamPresent = new Map<string, Map<string, number>>();
    for (const r of present) {
      const m = byCamPresent.get(r.camera) ?? new Map<string, number>();
      m.set(r.day, r.detections);
      byCamPresent.set(r.camera, m);
    }
    const filled: DailyCount[] = [];
    for (const [camera, m] of byCamPresent) {
      const days = [...m.keys()].sort();
      if (days.length === 0) continue;
      const firstPresent = days[0];
      const cameraPrecededWindow = (firstEver.get(camera) ?? '9999-99-99') < windowFromDay;
      const fillStart = cameraPrecededWindow ? windowFromDay : firstPresent;
      let cursor = new Date(`${fillStart}T00:00:00Z`);
      const last = new Date(`${days[days.length - 1]}T00:00:00Z`);
      while (cursor <= last) {
        const d = cursor.toISOString().slice(0, 10);
        filled.push({ day: d, camera, detections: m.get(d) ?? 0 });
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    const result = detectDailyAnomalies(filled, {});

    const tableRows: Array<(string | number | null)[]> = [
      ...result.spikes.map((s) => ['spike', `${s.day} (${s.camera})`, s.detections, `baseline ${s.mean}/day`]),
      ...result.gaps.map((g) => [
        'gap',
        `${g.from} → ${g.to} (${g.camera})`,
        '0',
        g.days === 1 ? '1 day with no detections' : `${g.days} days with no detections`,
      ]),
    ];

    return {
      tables:
        tableRows.length > 0
          ? [{ caption: 'Anomalies', headers: ['Type', 'Period', 'Detections', 'Note'], rows: tableRows }]
          : [],
      evidence: {
        detections: Number(countRow[0]?.detections ?? 0),
        events: Number(countRow[0]?.events ?? 0),
        cameras: [...new Set(rows.map((r) => String(r.camera_id ?? '')).filter(Boolean))],
      },
    };
  }
}
