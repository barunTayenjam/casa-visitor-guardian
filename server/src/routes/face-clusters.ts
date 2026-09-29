import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { AppDataSource } from '../database.js';
import { requireUser, optionalAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

const FACE_CLUSTER_DIR = path.join(process.cwd(), 'data', 'detections', 'face_clusters');
const FACE_CROPS_DIR = '/app/data/face_crops';

interface ClusteringStatus {
  isRunning: boolean;
  imagesScanned: number;
  totalImages: number;
  facesFound: number;
  clustersCreated: number;
  multiFaceClusters: number;
  lastUpdate: string;
  progressPercent: number;
  estimatedRemainingMinutes: number;
}

interface ClusterRow {
  cluster_id: string;
  name: string | null;
  image_path: string | null;
  face_count: number;
  description: string | null;
}

router.get('/clustering-status', requireUser, async (_req: Request, res: Response) => {
  try {
    const statusFile = path.join(FACE_CROPS_DIR, '..', 'clustering_status.json');
    const legacyStatusFile = '/app/data/clustering_status.json';
    let status: ClusteringStatus | null = null;

    for (const f of [statusFile, legacyStatusFile]) {
      try {
        if (fs.existsSync(f)) {
          const raw = JSON.parse(fs.readFileSync(f, 'utf-8'));
          // If timestamp is older than 5 minutes, clustering is not running
          const lastUpdate = new Date(raw.lastUpdate);
          const isRunning = Date.now() - lastUpdate.getTime() < 5 * 60 * 1000;
          status = {
            isRunning,
            imagesScanned: raw.imagesScanned || 0,
            totalImages: raw.totalImages || 0,
            facesFound: raw.facesFound || 0,
            clustersCreated: raw.clustersCreated || 0,
            multiFaceClusters: raw.multiFaceClusters || 0,
            lastUpdate: raw.lastUpdate || new Date().toISOString(),
            progressPercent: raw.totalImages
              ? Math.round((raw.imagesScanned / raw.totalImages) * 100)
              : 0,
            estimatedRemainingMinutes: raw.estimatedRemainingMinutes || 0,
          };
          break;
        }
      } catch {
        // ignore parse errors
      }
    }

    // If no status file exists, report not running with zero values
    if (!status) {
      status = {
        isRunning: false,
        imagesScanned: 0,
        totalImages: 0,
        facesFound: 0,
        clustersCreated: 0,
        multiFaceClusters: 0,
        lastUpdate: new Date().toISOString(),
        progressPercent: 0,
        estimatedRemainingMinutes: 0,
      };
    }

    res.json({ success: true, status });
  } catch (error) {
    logger.error('Error fetching clustering status', 'FaceClusters', error);
    res.status(500).json({ success: false, error: 'Failed to fetch clustering status' });
  }
});

router.get('/', requireUser, async (_req: Request, res: Response) => {
  try {
    const rows: ClusterRow[] = await AppDataSource.query(
      `SELECT cluster_id, name, image_path, face_count, description
       FROM face_clusters
       ORDER BY face_count DESC, cluster_id ASC`,
    );

    const clusters = rows.map((row) => ({
      cluster_id: row.cluster_id,
      name: row.name,
      face_count: row.face_count,
      description: row.description,
      representative_image: row.image_path
        ? `/api/face-clusters/image/${row.cluster_id}`
        : null,
    }));

    res.json({ success: true, clusters });
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

    // Look up crop path from DB
    const rows: Array<{ image_path: string | null }> = await AppDataSource.query(
      `SELECT image_path FROM face_clusters WHERE cluster_id = $1 LIMIT 1`,
      [clusterId],
    );

    if (!rows.length || !rows[0].image_path) {
      res.status(404).json({ success: false, error: 'Image not found' });
      return;
    }

    const imagePath = rows[0].image_path;
    if (fs.existsSync(imagePath)) {
      res.set('Content-Type', 'image/jpeg');
      return res.sendFile(imagePath);
    }

    // Fallback: legacy face_clusters directory
    const legacyPath = path.join(FACE_CLUSTER_DIR, clusterId, 'representative.jpg');
    if (fs.existsSync(legacyPath)) {
      res.set('Content-Type', 'image/jpeg');
      return res.sendFile(legacyPath);
    }

    res.status(404).json({ success: false, error: 'Image not found' });
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
      `UPDATE face_clusters SET name = $1, updated_at = NOW() WHERE cluster_id = $2`,
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
