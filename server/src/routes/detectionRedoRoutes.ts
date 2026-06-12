import { logger } from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { AppDataSource } from '../database.js';
import * as fs from 'fs/promises';
import * as path from 'path';

function validateDetections(detections: any[]): any[] {
  return detections.filter(detection => {
    if (!detection.bbox || typeof detection.bbox !== 'object') {
      return false;
    }
    const { x, y, width, height } = detection.bbox;
    if (typeof x !== 'number' || typeof y !== 'number' ||
        typeof width !== 'number' || typeof height !== 'number') {
      return false;
    }
    if (x < 0 || y < 0 || width <= 0 || height <= 0 ||
        x > 4096 || y > 2160 || width > 4096 || height > 2160) {
      return false;
    }
    const aspectRatio = width / height;
    if (aspectRatio > 10 || aspectRatio < 0.1) {
      return false;
    }
    if (width < 5 || height < 5) {
      return false;
    }
    if (width > 3000 || height > 2000) {
      return false;
    }
    if (typeof detection.confidence === 'number' &&
        (detection.confidence < 0 || detection.confidence > 100)) {
      return false;
    }
    return true;
  }).map(detection => {
    return {
      ...detection,
      bbox: {
        x: Math.round(detection.bbox.x),
        y: Math.round(detection.bbox.y),
        width: Math.round(detection.bbox.width),
        height: Math.round(detection.bbox.height)
      }
    };
  });
}

const router = Router();

// Endpoint to re-run detection on a specific image file
router.post('/rerun-detection', requireUser, validate({
  body: {
    filename: { type: 'string' as const, required: false, maxLength: 255, custom: (v: unknown) => { if (typeof v === 'string' && v.includes('..')) return 'Path traversal not allowed'; return true; } },
    filepath: { type: 'string' as const, required: false, maxLength: 500, custom: (v: unknown) => { if (typeof v === 'string' && (v.includes('..') || v.startsWith('/'))) return 'Path traversal not allowed'; return true; } }
  }
}), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { filename, filepath } = req.body;

    if (!filename && !filepath) {
      return res.status(400).json({
        success: false,
        error: 'Either filename or filepath is required'
      });
    }

    let fullPath: string;

    if (filepath) {
      fullPath = filepath;
    } else {
      // Construct path from filename assuming it follows the pattern
      // e.g., motion_cam1_2026-01-28T11-41-27-365Z.jpg
      const match = filename.match(/motion_(\w+)_(\d{4}-\d{2})/);
      if (!match) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filename format'
        });
      }

      const yearMonth = match[2];
      fullPath = path.join(process.cwd(), 'data', 'detections', yearMonth, 'events', 'motion', filename);
    }

    // Verify file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Read the image file
    const imageBuffer = await fs.readFile(fullPath);

    // Call the detection service to process the image
    // We'll use the same detection logic as in motionTriggeredDetection
    const { default: axios } = await import('axios');
    const { getOpenCVServiceUrl } = await import('../config/index.js');

    try {
      const response = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg'
        },
        timeout: 30000
      });

      const detections = response.data.detections || [];

      const validDetections = validateDetections(detections);

      // Update the database record with new detection results
      const updateQuery = `
        UPDATE detection_files
        SET metadata = jsonb_set(
          jsonb_set(metadata, '{detections}', $1::jsonb),
          '{totalDetections}', ($2)::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{personCount}', ($3)::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{hasPersons}', ($4)::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{objectCounts}', $5::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{uniqueClasses}', $6::jsonb
        )
        WHERE original_filename = $7
        RETURNING file_uuid
      `;

      const personCount = validDetections.filter(d => d.class === 'person').length;
      const uniqueClasses = Array.from(new Set(validDetections.map(d => d.class)));
      const objectCounts: Record<string, number> = {};
      uniqueClasses.forEach(cls => {
        objectCounts[cls] = validDetections.filter(d => d.class === cls).length;
      });

      await AppDataSource.query(updateQuery, [
        JSON.stringify(validDetections),
        validDetections.length,
        personCount,
        personCount > 0,
        JSON.stringify(objectCounts),
        JSON.stringify(uniqueClasses),
        filename
      ]);

      res.json({
        success: true,
        message: `Detection re-run completed for ${filename}`,
        originalDetections: detections.length,
        validDetections: validDetections.length,
        results: {
          totalDetections: validDetections.length,
          personCount,
          uniqueClasses,
          objectCounts,
          detections: validDetections
        }
      });
    } catch (detectionError) {
      logger.error('Error in re-detection', 'DetectionRedo', detectionError);
      res.status(500).json({
        success: false,
        error: 'Detection service error',
        details: detectionError instanceof Error ? detectionError.message : 'Unknown error'
      });
    }
  } catch (error) {
    logger.error('Error re-running detection', 'DetectionRedo', error);
    res.status(500).json({
      success: false,
      error: 'Failed to re-run detection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to re-run detection on a specific event by ID
router.post('/rerun-event-detection', requireUser, validate({
  body: {
    eventId: { type: 'string' as const, required: true, minLength: 1, maxLength: 100 }
  }
}), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'eventId is required'
      });
    }

    // Get event from database
    const event = await AppDataSource.query(
      'SELECT id, image_path, camera_id, timestamp FROM events WHERE id = $1',
      [eventId]
    );

    if (!event || event.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    const dbEvent = event[0];
    let imagePath = dbEvent.image_path;

    // Convert relative path to absolute if needed
    if (imagePath && !imagePath.startsWith('/')) {
      // Relative path from data/detections
      const match = imagePath.match(/(\d{4}-\d{2})\/events\/(motion|faces)\/(.+)$/);
      if (match) {
        const yearMonth = match[1];
        const type = match[2];
        const filename = match[3];
        imagePath = path.join(process.cwd(), 'data', 'detections', yearMonth, 'events', type, filename);
      }
    }

    // Verify file exists
    if (!imagePath) {
      return res.status(404).json({
        success: false,
        error: 'Image path not found in event'
      });
    }

    try {
      await fs.access(imagePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Image file not found'
      });
    }

    // Read and process image
    const imageBuffer = await fs.readFile(imagePath);
    const { default: axios } = await import('axios');
    const { getOpenCVServiceUrl } = await import('../config/index.js');

    const response = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, imageBuffer, {
      headers: { 'Content-Type': 'image/jpeg' },
      timeout: 30000
    });

    const detections = response.data.detections || [];

    const validDetections = validateDetections(detections);

    const personCount = validDetections.filter(d => d.class === 'person').length;
    const faceCount = validDetections.filter(d => d.class === 'face').length;
    const vehicleCount = validDetections.filter(d => ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.class)).length;
    const uniqueClasses = Array.from(new Set(validDetections.map(d => d.class)));

    // Update event in database
    await AppDataSource.query(
      `UPDATE events SET 
        persons_detected = $1,
        faces_detected = $2,
        object_detections = $3,
        detection_confidence = $4,
        last_analyzed_at = NOW()
      WHERE id = $5`,
      [personCount, faceCount, JSON.stringify(validDetections), Math.round((validDetections.reduce((acc, d) => acc + (d.confidence || 0), 0) / (validDetections.length || 1))), eventId]
    );

    res.json({
      success: true,
      message: `Detection re-run completed for event ${eventId}`,
      results: {
        totalDetections: validDetections.length,
        personCount,
        faceCount,
        vehicleCount,
        uniqueClasses,
        detections: validDetections
      }
    });
  } catch (error) {
    logger.error('Error re-running event detection', 'DetectionRedo', error);
    res.status(500).json({
      success: false,
      error: 'Failed to re-run detection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export function configureDetectionRedoRoutes(app: any): void {
  app.use('/api/detection-redo', router);
}

export default router;