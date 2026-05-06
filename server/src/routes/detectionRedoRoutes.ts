import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { AppDataSource } from '../database.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

// Endpoint to re-run detection on a specific image file
router.post('/rerun-detection', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
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
    const axios = await import('axios');
    const { getOpenCVServiceUrl } = await import('../config/index.js');

    try {
      const response = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg'
        },
        timeout: 30000
      });

      const detections = response.data.detections || [];

      // Import the validation function from motionTriggeredDetection
      const { MotionTriggeredDetection } = await import('../detection/motionTriggeredDetection.js');
      const validator = new MotionTriggeredDetection();
      const validDetections = validator['validateDetections'](detections);

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
      console.error('Error in re-detection:', detectionError);
      res.status(500).json({
        success: false,
        error: 'Detection service error',
        details: detectionError instanceof Error ? detectionError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error re-running detection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to re-run detection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to re-run detection on a specific event by ID
router.post('/rerun-event-detection', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
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
    const axios = await import('axios');
    const { getOpenCVServiceUrl } = await import('../config/index.js');

    const response = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, imageBuffer, {
      headers: { 'Content-Type': 'image/jpeg' },
      timeout: 30000
    });

    const detections = response.data.detections || [];

    // Validate detections
    const { MotionTriggeredDetection } = await import('../detection/motionTriggeredDetection.js');
    const validator = new MotionTriggeredDetection();
    const validDetections = validator['validateDetections'](detections);

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
    console.error('Error re-running event detection:', error);
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