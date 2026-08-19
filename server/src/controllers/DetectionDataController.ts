import { Request, Response } from 'express';
import { AppDataSource } from '../database.js';
import { EventDetection } from '../models/EventDetection.js';

interface ListParams {
  class?: string;
  camera?: string;
  tier?: string;
  verified?: string;
  threat?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

export const detectionDataController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query as ListParams;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? '50', 10) || 50));

      const repo = AppDataSource.getRepository(EventDetection);

      let builder = repo
        .createQueryBuilder('ed')
        .leftJoin('events', 'e', 'e.id = ed.event_id')
        .where('1=1');
      if (q.class) builder = builder.andWhere('ed.class = :cls', { cls: q.class });
      if (q.camera) builder = builder.andWhere('ed.camera_id = :cam', { cam: q.camera });
      if (q.tier) builder = builder.andWhere('ed.verification_tier = :tier', { tier: q.tier });
      if (q.verified === 'true') builder = builder.andWhere('ed.human_verified = true');
      if (q.verified === 'false') builder = builder.andWhere('ed.human_verified = false');
      if (q.threat) builder = builder.andWhere(`e.threat_assessment->>'level' = :threat`, { threat: q.threat });
      if (q.from) builder = builder.andWhere('ed.timestamp >= :from', { from: q.from });
      if (q.to) builder = builder.andWhere('ed.timestamp <= :to', { to: q.to });

      const total = await builder.clone().getCount();

      const rows = await builder
        .clone()
        .orderBy('ed.timestamp', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit)
        .select('ed.id', 'id')
        .addSelect('ed.event_id', 'eventId')
        .addSelect('ed.camera_id', 'cameraId')
        .addSelect('ed.timestamp', 'timestamp')
        .addSelect('ed.class', 'class')
        .addSelect('ed.class_id', 'classId')
        .addSelect('ed.confidence', 'confidence')
        .addSelect('ed.bbox_x', 'bboxX')
        .addSelect('ed.bbox_y', 'bboxY')
        .addSelect('ed.bbox_w', 'bboxW')
        .addSelect('ed.bbox_h', 'bboxH')
        .addSelect('ed.track_id', 'trackId')
        .addSelect('ed.track_state', 'trackState')
        .addSelect('ed.tracklet_len', 'trackletLen')
        .addSelect('ed.identity', 'identity')
        .addSelect('ed.identity_confidence', 'identityConfidence')
        .addSelect('ed.human_verified', 'humanVerified')
        .addSelect('ed.verification_tier', 'verificationTier')
        .addSelect('ed.person_attributes', 'personAttributes')
        .addSelect(`jsonb_array_length(coalesce(ed.face_embedding, '[]'::jsonb))`, 'embeddingDim')
        .addSelect('e.event_type', 'eventType')
        .addSelect('e.file_path', 'filePath')
        .addSelect('e.severity', 'severity')
        .addSelect(`coalesce(e.threat_assessment->>'level', '')`, 'threatLevel')
        .addSelect('e.motion_stats', 'motionStats')
        .addSelect('e.scene_context', 'sceneContext')
        .getRawAndEntities();

      const data = rows.raw.map((r: Record<string, unknown>) => ({
        id: Number(r.id),
        eventId: r.eventId,
        cameraId: r.cameraId,
        timestamp: r.timestamp,
        class: r.class,
        classId: r.classId === null ? null : Number(r.classId),
        confidence: r.confidence === null ? null : Number(r.confidence),
        bbox: {
          x: r.bboxX === null ? null : Number(r.bboxX),
          y: r.bboxY === null ? null : Number(r.bboxY),
          w: r.bboxW === null ? null : Number(r.bboxW),
          h: r.bboxH === null ? null : Number(r.bboxH),
        },
        trackId: r.trackId === null ? null : Number(r.trackId),
        trackState: r.trackState,
        trackletLen: r.trackletLen === null ? null : Number(r.trackletLen),
        identity: r.identity,
        identityConfidence: r.identityConfidence === null ? null : Number(r.identityConfidence),
        humanVerified: r.humanVerified,
        verificationTier: r.verificationTier,
        personAttributes: r.personAttributes ?? null,
        embeddingDim: Number(r.embeddingDim ?? 0),
        eventType: r.eventType,
        filePath: r.filePath,
        severity: r.severity,
        threatLevel: r.threatLevel || null,
        motionStats: r.motionStats ?? null,
        sceneContext: r.sceneContext ?? null,
      }));

      res.json({ success: true, data: { rows: data, total, page, limit } });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to list detections' });
    }
  },

  async stats(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query as { from?: string; to?: string; camera?: string };
      const values: unknown[] = [];
      const conds: string[] = ['1=1'];
      const bind = (v: unknown) => `$${values.push(v)}`;
      if (q.from) conds.push(`ed.timestamp >= ${bind(q.from)}`);
      if (q.to) conds.push(`ed.timestamp <= ${bind(q.to)}`);
      if (q.camera) conds.push(`ed.camera_id = ${bind(q.camera)}`);
      const where = conds.join(' AND ');

      const run = async (sql: string) =>
        AppDataSource.query(sql.replace(/__WHERE__/g, where), values);

      const byClass = await run(
        `SELECT ed.class AS key, count(*) AS count FROM event_detections ed WHERE __WHERE__ GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
      );
      const byTier = await run(
        `SELECT coalesce(ed.verification_tier, 'unverified') AS key, count(*) AS count FROM event_detections ed WHERE __WHERE__ AND ed.class = 'person' GROUP BY 1 ORDER BY 2 DESC`,
      );
      const byThreat = await run(
        `SELECT coalesce(e.threat_assessment->>'level', 'none') AS key, count(DISTINCT e.id) AS count FROM event_detections ed JOIN events e ON e.id = ed.event_id WHERE __WHERE__ GROUP BY 1 ORDER BY 2 DESC`,
      );
      const byClothing = await run(
        `SELECT ed.person_attributes->>'clothing' AS key, count(*) AS count FROM event_detections ed WHERE __WHERE__ AND jsonb_exists(ed.person_attributes, 'clothing') GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
      );
      const byDistance = await run(
        `SELECT ed.person_attributes->>'distance' AS key, count(*) AS count FROM event_detections ed WHERE __WHERE__ AND jsonb_exists(ed.person_attributes, 'distance') GROUP BY 1 ORDER BY 2 DESC`,
      );
      const hourly = await run(
        `SELECT to_char(ed.timestamp, 'YYYY-MM-DD HH24') AS key, count(*) AS count FROM event_detections ed WHERE __WHERE__ AND ed.timestamp > now() - interval '24 hours' GROUP BY 1 ORDER BY 1`,
      );
      const cameras = await run(
        `SELECT ed.camera_id AS key, count(*) AS count FROM event_detections ed WHERE __WHERE__ GROUP BY 1 ORDER BY 2 DESC`,
      );

      res.json({
        success: true,
        data: { byClass, byTier, byThreat, byClothing, byDistance, hourly, cameras },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to compute stats' });
    }
  },
};
