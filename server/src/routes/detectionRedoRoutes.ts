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

export function configureDetectionRedoRoutes(app: any): void {
  app.use('/api/detection-redo', router);
}

export default router;