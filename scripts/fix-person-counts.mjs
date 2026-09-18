#!/usr/bin/env node
import { DataSource } from 'typeorm';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'sentryvision',
  username: process.env.DB_USER || 'sentryvision',
  password: process.env.DB_PASSWORD || 'sentryvision',
});

const iou = (a, b) => {
  const ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx2 = b.x + b.width, by2 = b.y + b.height;
  const inter =
    Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
};

function dedupDetections(dets) {
  const active = dets.filter(d => d.class === 'person' && (d.trackState ?? '') !== 'lost');
  const seen = [];
  return active.filter(d => {
    if (seen.some(s => iou(d.bbox, s.bbox) > 0.3)) return false;
    seen.push(d);
    return true;
  });
}

async function main() {
  await ds.initialize();
  const rows = await ds.query(
    `SELECT id, object_detections, persons_detected
     FROM events
     WHERE event_type = 'person' AND persons_detected > 1
     AND timestamp >= '2026-08-26 00:00:00'`
  );

  console.log(`Found ${rows.length} overcounted events`);
  let fixed = 0;

  for (const row of rows) {
    const dets = row.object_detections ?? [];
    const deduped = dedupDetections(dets);
    const newCount = deduped.length;

    if (newCount !== row.persons_detected) {
      await ds.query(
        `UPDATE events
         SET persons_detected = $1,
             object_detections = $2
         WHERE id = $3`,
        [newCount, JSON.stringify(deduped), row.id]
      );
      fixed++;
      console.log(`  ${row.id}: ${row.persons_detected} → ${newCount}`);
    }
  }

  console.log(`Fixed ${fixed}/${rows.length} events`);
  await ds.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
