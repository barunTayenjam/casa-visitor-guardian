import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { AppDataSource } from '../database.js';
import { requireUser, optionalAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

const FACE_CLUSTER_DIR = path.join(process.cwd(), 'data', 'detections', 'face_clusters');

interface ClusterRow {
  cluster_id: string;
  name: string | null;
  event_id: string;
  timestamp: Date;
  image_path: string;
  embedding_quality: number;
}

router.get('/', requireUser, async (_req: Request, res: Response) => {
  try {
    const rows: ClusterRow[] = await AppDataSource.query(
      `SELECT cluster_id, name, event_id, timestamp, image_path, embedding_quality
       FROM face_clusters ORDER BY cluster_id ASC`,
    );

    const clusters = new Map<
      string,
      {
        cluster_id: string;
        name: string | null;
        face_count: number;
        event_ids: string[];
        first_seen: string;
        last_seen: string;
        representative_image: string;
      }
    >();

    for (const row of rows) {
      let c = clusters.get(row.cluster_id);
      if (!c) {
        c = {
          cluster_id: row.cluster_id,
          name: row.name,
          face_count: 0,
          event_ids: [],
          first_seen: row.timestamp.toISOString(),
          last_seen: row.timestamp.toISOString(),
          representative_image: `/api/face-clusters/image/${row.cluster_id}`,
        };
        clusters.set(row.cluster_id, c);
      }
      c.face_count += 1;
      c.event_ids.push(row.event_id);
      if (row.timestamp < new Date(c.first_seen)) c.first_seen = row.timestamp.toISOString();
      if (row.timestamp > new Date(c.last_seen)) c.last_seen = row.timestamp.toISOString();
    }

    res.json({ success: true, clusters: Array.from(clusters.values()) });
  } catch (error) {
    logger.error('Error fetching face clusters', 'FaceClusters', error);
    res.status(500).json({ success: false, error: 'Failed to fetch face clusters' });
  }
});

router.get('/image/:clusterId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { clusterId } = req.params;
    if (!/^[a-zA-Z0-9_-]+$/.test(clusterId)) {
      res.status(400).json({ success: false, error: 'Invalid cluster ID' });
      return;
    }
    const imagePath = path.join(FACE_CLUSTER_DIR, clusterId, 'representative.jpg');
    if (!fs.existsSync(imagePath)) {
      res.status(404).json({ success: false, error: 'Image not found' });
      return;
    }
    res.set('Content-Type', 'image/jpeg');
    res.sendFile(imagePath);
  } catch (error) {
    logger.error('Error serving cluster image', 'FaceClusters', error);
    res.status(500).json({ success: false, error: 'Failed to serve image' });
  }
});
router.post('/:clusterId/name', requireUser, async (req: Request, res: Response) => {
  try {
    const { clusterId } = req.params;
    const { name } = req.body;
    if (!clusterId || !/^[a-zA-Z0-9_-]+$/.test(clusterId)) {
      res.status(400).json({ success: false, error: 'Invalid cluster ID' });
      return;
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      res.status(400).json({ success: false, error: 'Name is required (1-100 chars)' });
      return;
    }

    const result = await AppDataSource.query(
      `UPDATE face_clusters SET name = $1 WHERE cluster_id = $2`,
      [name.trim(), clusterId],
    );

    if (result[1] === 0) {
      res.status(404).json({ success: false, error: 'Cluster not found' });
      return;
    }

    res.json({ success: true, message: `Cluster ${clusterId} named "${name.trim()}"` });
  } catch (error) {
    logger.error('Error assigning cluster name', 'FaceClusters', error);
    res.status(500).json({ success: false, error: 'Failed to assign name' });
  }
});

export default router;
