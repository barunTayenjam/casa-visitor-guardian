import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database/index';

const router = Router();

// Get processed images with detections for viewing
router.get('/processed-images', async (req: Request, res: Response) => {
  try {
    const { jobId, objectClass, minConfidence, limit = '100', offset = '0' } = req.query;
    
    let query = `
      SELECT 
        id, job_id, filename, file_path, camera_id, image_timestamp,
        person_count, face_count, known_face_count, unknown_face_count,
        status, detection_json, processed_at
      FROM processed_images
      WHERE status IN ('success', 'no_detections')
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (jobId) {
      query += ` AND job_id = $${paramIndex++}`;
      params.push(jobId);
    }
    
    if (objectClass) {
      query += ` AND detection_json::text LIKE $${paramIndex++}`;
      params.push(`%"class":"${objectClass}"%`);
    }
    
    if (minConfidence) {
      query += ` AND (person_count > 0 OR face_count > 0)`;
    }
    
    query += ` ORDER BY processed_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const result = await AppDataSource.query(query, params);
    
    // Get image URLs for each result
    const processed = result.map((row: any) => ({
      id: row.id,
      jobId: row.job_id,
      filename: row.filename,
      filePath: row.file_path,
      cameraId: row.camera_id,
      timestamp: row.image_timestamp,
      personCount: row.person_count,
      faceCount: row.face_count,
      knownFaceCount: row.known_face_count,
      unknownFaceCount: row.unknown_face_count,
      status: row.status,
      detections: row.detection_json,
      processedAt: row.processed_at,
      imageUrl: `/api/events/image/${row.filename}`
    }));
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM processed_images WHERE status IN ('success', 'no_detections')`;
    if (jobId) {
      countQuery += ` AND job_id = '${jobId}'`;
    }
    const countResult = await AppDataSource.query(countQuery);
    const total = parseInt(countResult[0].total);
    
    res.json({
      success: true,
      images: processed,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (parseInt(offset as string) + processed.length) < total
      }
    });
  } catch (error: any) {
    console.error('Error getting processed images:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single processed image with full details
router.get('/processed-images/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await AppDataSource.query(
      `SELECT 
        id, job_id, filename, file_path, camera_id, image_timestamp,
        person_count, face_count, known_face_count, unknown_face_count,
        status, detection_json, processed_at, file_hash
      FROM processed_images
      WHERE id = $1`,
      [id]
    );
    
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Processed image not found'
      });
    }
    
    const row = result[0];
    
    res.json({
      success: true,
      image: {
        id: row.id,
        jobId: row.job_id,
        filename: row.filename,
        filePath: row.file_path,
        cameraId: row.camera_id,
        timestamp: row.image_timestamp,
        personCount: row.person_count,
        faceCount: row.face_count,
        knownFaceCount: row.known_face_count,
        unknownFaceCount: row.unknown_face_count,
        status: row.status,
        detections: row.detection_json,
        processedAt: row.processed_at,
        fileHash: row.file_hash,
        imageUrl: `/api/events/image/${row.filename}`
      }
    });
  } catch (error: any) {
    console.error('Error getting processed image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;