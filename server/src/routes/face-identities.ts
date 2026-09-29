import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database.js';
import { requireUser, optionalAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

interface FaceIdentity {
  identity: string;
  event_count: number;
  first_seen: string;
  last_seen: string;
  avg_confidence: number;
  has_embedding: boolean;
  representative_event_id: string | null;
  representative_image: string | null;
  camera_ids: string[];
}

interface FaceIdentityRow {
  identity: string;
  event_count: string;
  first_seen: string;
  last_seen: string;
  avg_confidence: string;
  has_embedding: boolean;
  representative_event_id: string | null;
  representative_image: string | null;
  camera_ids: string[] | null;
}

router.get('/', requireUser, async (_req: Request, res: Response) => {
  try {
    const rows: FaceIdentityRow[] = await AppDataSource.query(`
      WITH latest_persons AS (
        SELECT
          ed.identity,
          ed.event_id,
          ed.identity_confidence,
          ed.face_embedding,
          ed.camera_id,
          ed.timestamp,
          e.file_path,
          ROW_NUMBER() OVER (PARTITION BY ed.identity ORDER BY ed.timestamp DESC) as rn
        FROM event_detections ed
        JOIN events e ON ed.event_id = e.id
        WHERE ed.class = 'person'
          AND ed.identity IS NOT NULL
          AND ed.identity NOT LIKE '[file]%%'
          AND ed.identity != ''
      )
      SELECT
        identity,
        COUNT(*) as event_count,
        MIN(timestamp) as first_seen,
        MAX(timestamp) as last_seen,
        ROUND(AVG(identity_confidence)::numeric, 3) as avg_confidence,
        bool_or(face_embedding IS NOT NULL) as has_embedding,
        MAX(event_id::text) FILTER (WHERE rn = 1) as representative_event_id,
        MAX(file_path) FILTER (WHERE rn = 1 AND file_path IS NOT NULL) as representative_image,
        ARRAY_AGG(DISTINCT camera_id) as camera_ids
      FROM latest_persons
      GROUP BY identity
      ORDER BY event_count DESC, last_seen DESC
    `);

    const identities: FaceIdentity[] = rows.map(row => ({
      identity: row.identity,
      event_count: parseInt(row.event_count, 10),
      first_seen: row.first_seen,
      last_seen: row.last_seen,
      avg_confidence: parseFloat(row.avg_confidence),
      has_embedding: row.has_embedding,
      representative_event_id: row.representative_event_id,
      representative_image: row.representative_image
        ? `/api/events/image/${row.representative_image.split('/').pop()}`
        : null,
      camera_ids: row.camera_ids || [],
    }));

    res.json({ success: true, identities });
  } catch (error) {
    logger.error('Error fetching face identities', 'FaceIdentities', error);
    res.status(500).json({ success: false, error: 'Failed to fetch face identities' });
  }
});

router.post('/:identity/name', requireUser, async (req: Request, res: Response) => {
  try {
    const { identity } = req.params;
    const { name } = req.body;

    if (!identity || !/^[a-zA-Z0-9_\-]+$/.test(identity)) {
      return res.status(400).json({ success: false, error: 'Invalid identity' });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return res.status(400).json({ success: false, error: 'Name is required (1-100 chars)' });
    }

    const trimmedName = name.trim();

    await AppDataSource.query(
      `UPDATE event_detections SET identity = $1 WHERE identity = $2`,
      [trimmedName, identity]
    );

    const cropDir = '/app/data/face_crops';
    const oldDir = `${cropDir}/${identity}`;
    const newDir = `${cropDir}/${trimmedName}`;

    if (require('fs').existsSync(oldDir)) {
      require('fs').renameSync(oldDir, newDir);
    }

    res.json({ success: true, message: `Identity "${identity}" renamed to "${trimmedName}"` });
  } catch (error) {
    logger.error('Error renaming face identity', 'FaceIdentities', error);
    res.status(500).json({ success: false, error: 'Failed to rename identity' });
  }
});

export default router;