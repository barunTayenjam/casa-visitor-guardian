import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { createApiRateLimit } from '../middleware/enhancedRateLimit.js';
import { requireUser, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { streamController } from '../controllers/StreamController.js';
import { systemController } from '../controllers/SystemController.js';

import authRoutes from './auth.js';
import cameraRoutes from './cameras.js';
import streamRoutes from './streams.js';
import analyticsRoutes from './analytics.js';
import settingsRoutes from './settings.js';
import reviewRoutes from './review.js';
import nvidiaRoutes from './nvidiaRoutes.js';
import motionRoutes from './motion.js';
import eventSearchRoutes from './event-search.js';
import eventRoutes from './events.js';
import alertRoutes from './alerts.js';
import notificationRoutes from './notificationRoutes.js';
import detectionOperationsRoutes from './detection-operations.js';
import detectionRoutes from './detectionRoutes.js';
import faceEmbeddingRoutes from './faceEmbeddingRoutes.js';
import faceConfigRoutes from './faceConfigRoutes.js';
import detectionRedoRoutes from './detectionRedoRoutes.js';
import highlightsRoutes from './highlights.js';
import visitorRoutes from './visitorRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAMERA_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateCameraId(cameraId: string): boolean {
  return CAMERA_ID_PATTERN.test(cameraId) && cameraId.length <= 100;
}

function validateCameraIdParam(cameraId: string, res: Response): boolean {
  if (!cameraId || !validateCameraId(cameraId)) {
    res.status(400).json({ success: false, error: 'Invalid camera ID format' });
    return false;
  }
  return true;
}

const parseTimestampFromFilename = (filename: string): number => {
  const parts = filename.split('_');
  if (parts.length >= 3) {
    const timestampPart = parts[2]?.split('.')[0];
    if (timestampPart) {
      const cleanTimestampPart = timestampPart.replace(/Z$/, '');
      const numericTimestamp = parseInt(cleanTimestampPart, 10);
      if (!isNaN(numericTimestamp) && /^\d+$/.test(cleanTimestampPart) && cleanTimestampPart.length > 4) {
        const parsedDate = new Date(numericTimestamp);
        if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
      } else if (timestampPart.includes('T')) {
        const [datePart, timePartWithZ] = timestampPart.split('T');
        if (datePart && timePartWithZ) {
          const timeParts = timePartWithZ.split('-');
          let ms = 0, formattedTime = '';
          if (timeParts.length === 4) {
            ms = parseInt(timeParts[3].replace('Z', ''), 10);
            formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}.${ms}Z`;
          } else if (timeParts.length === 3) {
            formattedTime = timeParts[2].includes('Z')
              ? `${timeParts[0]}:${timeParts[1]}:${timeParts[2].replace('Z', '')}Z`
              : `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}Z`;
          }
          if (formattedTime) {
            const parsedDate = new Date(`${datePart}T${formattedTime}`);
            if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
          }
        }
      }
    }
  }
  return 0;
};

function getStreamManager() { return serviceRegistry.getStreamManager(); }

logger.info('Configuring main API routes', 'ROUTES');

export function configureRoutes(app: Express, io: SocketIOServer) {
  // Store io on app for route files that need it
  app.set('io', io);

  // Controller-delegated routes (unique paths that can't be grouped under /api prefix)
  app.get('/api/streaming/metrics', optionalAuth, (req, res) => streamController.getMetrics(req, res));
  app.get('/snapshot/:cameraId.jpg', (req, res) => streamController.getSnapshot(req, res));
  app.get('/stream/:cameraId/test', (req, res) => streamController.getMjpegStream(req, res));
  app.get('/stream/:cameraId', optionalAuth, (req, res) => streamController.getMjpegStream(req, res));

  // System routes
  app.get('/api/health', (req, res) => systemController.health(req, res));
  app.get('/api/stats', optionalAuth, (req, res) => systemController.stats(req, res));
  app.get('/api/system/overview', requireUser, (req, res) => systemController.overview(req, res));
  app.get('/api/system/health', optionalAuth, (req, res) => systemController.systemHealth(req, res));
  app.get('/api/system/logs', requireUser, (req, res) => systemController.getLogs(req, res));
  app.delete('/api/system/logs', requireAdmin, (req, res) => systemController.clearLogs(req, res));
  app.post('/api/maintenance/cleanup-images', requireAdmin, (req, res) => systemController.cleanupImages(req, res));
  app.post('/api/maintenance/cleanup-full', requireAdmin, (req, res) => systemController.runFullCleanup(req, res));
  app.get('/api/maintenance/cleanup-status', requireAdmin, (req, res) => systemController.cleanupStatus(req, res));

  // Detection image with overlays
  app.get('/detections/image/:imageId', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { imageId } = req.params;
      const { overlays } = req.query;
      const dataSource = serviceRegistry.getAppDataSource();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageId);
      if (!isUuid && !imageId.includes('.')) {
        return res.status(400).json({ success: false, error: 'Invalid image ID format' });
      }

      const detectionFields = overlays === 'true'
        ? `COALESCE(e.object_detections, '[]') as object_detections, COALESCE(e.face_detections, '[]') as face_detections,` : '';

      const results = await dataSource.query(
        `SELECT COALESCE(df.file_uuid::text, e.id::text) as file_uuid, COALESCE(df.storage_path, e.file_path) as file_path, COALESCE(df.storage_path, e.file_path) as imagePath, COALESCE(df.metadata, e.metadata) as metadata, COALESCE(df.camera_id, e.camera_id) as camera_id, ${detectionFields} COALESCE(df.original_filename, e.file_path) as original_filename FROM events e LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename WHERE df.file_uuid = $1 OR e.file_path = $1 OR df.original_filename = $1 ORDER BY COALESCE(df.created_at, e.created_at) DESC LIMIT 1`,
        [imageId]);

      if (results.length === 0) { res.status(404).json({ success: false, error: 'Detection image not found' }); return; }

      const detection = results[0];
      let imagePath = detection.storage_path;
      if (!path.isAbsolute(imagePath)) imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
      if (!fs.existsSync(imagePath)) { res.status(404).json({ success: false, error: 'Image file not found on disk' }); return; }

      if (overlays === 'true') {
        const sharp = (await import('sharp')).default;
        const objectDetections: Array<Record<string, unknown>> = typeof detection.object_detections === 'string' ? JSON.parse(detection.object_detections) : (detection.object_detections || []);
        const faceDetections: Array<Record<string, unknown>> = typeof detection.face_detections === 'string' ? JSON.parse(detection.face_detections) : (detection.face_detections || []);
        const allDetections = [...objectDetections, ...faceDetections];

        if (allDetections.length > 0) {
          const svgOverlays = allDetections.map((d, i) => {
            const box = (d.box || d.bounding_box || d.box) as Record<string, number> | undefined;
            if (!box) return '';
            const x = box.x ?? box.xmin ?? 0; const y = box.y ?? box.ymin ?? 0;
            const w = box.w ?? box.width ?? (box.xmax ? box.xmax - x : 0);
            const h = box.h ?? box.height ?? (box.ymax ? box.ymax - y : 0);
            const label = (d.label || d.class || 'unknown') as string;
            const conf = d.confidence ? `${Math.round((d.confidence as number) * 100)}%` : '';
            const color = i % 2 === 0 ? '#00ff00' : '#ff4444';
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3"/><text x="${x}" y="${y - 5}" fill="${color}" font-size="16" font-family="monospace">${label} ${conf}</text>`;
          }).filter(Boolean).join('\n');

          const overlaidImage = await sharp(imagePath)
            .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${svgOverlays}</svg>`), top: 0, left: 0 }])
            .jpeg({ quality: 90 }).toBuffer();
          res.set('Content-Type', 'image/jpeg');
          return res.send(overlaidImage);
        }
      }

      res.json({ success: true, imageUrl: `/events/${detection.original_filename}`, imagePath: detection.storage_path, metadata: detection.metadata ? JSON.parse(detection.metadata) : null, overlaysEnabled: overlays === 'true' });
    } catch (error) {
      logger.error('Error getting detection image', 'API', error);
      res.status(500).json({ success: false, error: 'Failed to get detection image' });
    }
  });

  // Snapshots list
  app.get('/api/snapshots/list', optionalAuth, async (req: Request, res: Response) => {
    try {
      const results = await AppDataSource.query(
        `SELECT COALESCE(df.storage_path, e.file_path) as file_path, COALESCE(df.capture_timestamp, e.timestamp) as timestamp FROM events e LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename WHERE COALESCE(df.file_type, e.event_type) = 'snapshot' ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC LIMIT 1000`);
      res.json({ success: true, files: results.map((row: any) => row.file_path) });
    } catch (error) {
      logger.error('Error listing snapshots', 'API', error);
      res.status(500).json({ success: false, error: 'Failed to list snapshots' });
    }
  });

  // Domain routers
  app.use('/api/auth', authRoutes);
  app.use('/api/cameras', cameraRoutes);
  app.use('/api/streams', streamRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/review', reviewRoutes);
  app.use('/api/nvidia', nvidiaRoutes);
  app.use('/api/motion', motionRoutes);
  app.use('/api/events', eventSearchRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/detection', detectionOperationsRoutes);
  app.use('/api/detection', detectionRoutes);
  app.use('/api/face-embeddings', faceEmbeddingRoutes);
  app.use('/api/face-config', faceConfigRoutes);
  app.use('/api/detection-redo', detectionRedoRoutes);
  app.use('/api/highlights', highlightsRoutes);
  app.use('/api/visitors', visitorRoutes);

  app.use(createApiRateLimit());
}
