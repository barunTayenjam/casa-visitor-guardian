import { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../utils/logger.js';
import { serviceRegistry } from '../services/serviceRegistry.js';

export class DetectionImageController {
  async getImageWithOverlay(req: Request, res: Response): Promise<void> {
    try {
      const { imageId } = req.params;
      const { overlays } = req.query;
      const dataSource = serviceRegistry.getAppDataSource();

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        imageId,
      );
      if (!isUuid && !imageId.includes('.')) {
        res.status(400).json({ success: false, error: 'Invalid image ID format' });
        return;
      }

      const detectionFields =
        overlays === 'true'
          ? `COALESCE(e.object_detections, '[]') as object_detections, COALESCE(e.face_detections, '[]') as face_detections,`
          : '';

      const results = await dataSource.query(
        `SELECT COALESCE(df.file_uuid::text, e.id::text) as file_uuid, COALESCE(df.storage_path, e.file_path) as file_path, COALESCE(df.storage_path, e.file_path) as imagePath, COALESCE(df.metadata, e.metadata) as metadata, COALESCE(df.camera_id, e.camera_id) as camera_id, ${detectionFields} COALESCE(df.original_filename, e.file_path) as original_filename FROM events e LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename WHERE df.file_uuid = $1 OR e.file_path = $1 OR df.original_filename = $1 ORDER BY COALESCE(df.created_at, e.created_at) DESC LIMIT 1`,
        [imageId],
      );

      if (results.length === 0) {
        res.status(404).json({ success: false, error: 'Detection image not found' });
        return;
      }

      const detection = results[0];
      let imagePath = detection.storage_path;
      if (!path.isAbsolute(imagePath))
        imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
      if (!fs.existsSync(imagePath)) {
        res.status(404).json({ success: false, error: 'Image file not found on disk' });
        return;
      }

      if (overlays === 'true') {
        const sharp = (await import('sharp')).default;
        const objectDetections: Array<Record<string, unknown>> =
          typeof detection.object_detections === 'string'
            ? JSON.parse(detection.object_detections)
            : detection.object_detections || [];
        const faceDetections: Array<Record<string, unknown>> =
          typeof detection.face_detections === 'string'
            ? JSON.parse(detection.face_detections)
            : detection.face_detections || [];
        const allDetections = [...objectDetections, ...faceDetections];

        if (allDetections.length > 0) {
          const svgOverlays = allDetections
            .map((d, i) => {
              const box = (d.box || d.bounding_box || d.box) as Record<string, number> | undefined;
              if (!box) return '';
              const x = box.x ?? box.xmin ?? 0;
              const y = box.y ?? box.ymin ?? 0;
              const w = box.w ?? box.width ?? (box.xmax ? box.xmax - x : 0);
              const h = box.h ?? box.height ?? (box.ymax ? box.ymax - y : 0);
              const label = (d.label || d.class || 'unknown') as string;
              const conf = d.confidence ? `${Math.round((d.confidence as number) * 100)}%` : '';
              const color = i % 2 === 0 ? '#00ff00' : '#ff4444';
              return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3"/><text x="${x}" y="${y - 5}" fill="${color}" font-size="16" font-family="monospace">${label} ${conf}</text>`;
            })
            .filter(Boolean)
            .join('\n');

          const overlaidImage = await sharp(imagePath)
            .composite([
              {
                input: Buffer.from(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${svgOverlays}</svg>`,
                ),
                top: 0,
                left: 0,
              },
            ])
            .jpeg({ quality: 90 })
            .toBuffer();
          res.set('Content-Type', 'image/jpeg');
          res.send(overlaidImage);
          return;
        }
      }

      res.json({
        success: true,
        imageUrl: `/events/${detection.original_filename}`,
        imagePath: detection.storage_path,
        metadata: detection.metadata ? JSON.parse(detection.metadata) : null,
        overlaysEnabled: overlays === 'true',
      });
    } catch (error) {
      logger.error('Error getting detection image', 'API', error);
      res.status(500).json({ success: false, error: 'Failed to get detection image' });
    }
  }

  async listSnapshots(req: Request, res: Response): Promise<void> {
    try {
      const { AppDataSource } = await import('../database.js');
      const results = await AppDataSource.query(
        `SELECT COALESCE(df.storage_path, e.file_path) as file_path, COALESCE(df.capture_timestamp, e.timestamp) as timestamp FROM events e LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename WHERE COALESCE(df.file_type, e.event_type) = 'snapshot' ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC LIMIT 1000`,
      );
      res.json({ success: true, files: results.map((row: any) => row.file_path) });
    } catch (error) {
      logger.error('Error listing snapshots', 'API', error);
      res.status(500).json({ success: false, error: 'Failed to list snapshots' });
    }
  }
}

export const detectionImageController = new DetectionImageController();
