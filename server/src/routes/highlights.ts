import { logger } from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import path from 'node:path';
import { AppDataSource } from '../database.js';
import { optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = Router();

router.get('/:date', optionalAuth, validate({
  params: {
    date: { type: 'string' as const, required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ }
  },
  query: {
    sort: { type: 'string' as const, required: false, enum: ['recent', 'persons', 'faces', 'unknown', 'confidence'] },
    limit: { type: 'number' as const, required: false, min: 1, max: 1000 }
  }
}), async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const { sort = 'recent', limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 0;

    const startDate = new Date(`${date}T00:00:00+05:30`);
    const endDate = new Date(`${date}T23:59:59.999+05:30`);

    let orderBy = 'ORDER BY e.timestamp DESC';
    let whereConditions = '';

    if (sort === 'persons') orderBy = 'ORDER BY COALESCE(e.persons_detected, 0) DESC, e.timestamp DESC';
    else if (sort === 'faces') orderBy = 'ORDER BY COALESCE(e.faces_detected, 0) DESC, e.timestamp DESC';
    else if (sort === 'unknown') { whereConditions = 'AND COALESCE(e.unknown_faces_count, 0) > 0'; orderBy = 'ORDER BY e.timestamp DESC'; }
    else if (sort === 'confidence') orderBy = 'ORDER BY e.confidence DESC, e.timestamp DESC';

    let query = `SELECT e.id, e.file_path as filename, e.camera_id, e.timestamp, e.event_type, e.confidence, e.persons_detected, e.faces_detected, e.known_faces_count, e.unknown_faces_count, e.object_detections, e.face_detections, e.metadata FROM events e WHERE e.timestamp BETWEEN $1 AND $2 AND e.event_type IN ('motion', 'face', 'event_motion', 'event_face') ${whereConditions} ${orderBy}`;
    if (limitNum > 0) query += ` LIMIT ${limitNum}`;

    const results = await AppDataSource.query(query, [startDate, endDate]);
    const highlights = results.map((row: any) => {
      const metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
      const filename = row.filename ? path.basename(row.filename) : null;
      return { id: row.id, filename, cameraId: row.camera_id, timestamp: row.timestamp, eventType: row.event_type, confidence: row.confidence, personsDetected: row.persons_detected || 0, facesDetected: row.faces_detected || 0, knownFacesCount: row.known_faces_count || 0, unknownFacesCount: row.unknown_faces_count || 0, objectDetections: row.object_detections || [], faceDetections: row.face_detections || [], imageUrl: filename ? `/api/events/image/${filename}` : null, metadata };
    });

    res.json({ success: true, date, sort, highlights, summary: { total: highlights.length, totalPersons: highlights.reduce((s: number, h: { personsDetected: number }) => s + h.personsDetected, 0), totalFaces: highlights.reduce((s: number, h: { facesDetected: number }) => s + h.facesDetected, 0), knownFaces: highlights.reduce((s: number, h: { knownFacesCount: number }) => s + h.knownFacesCount, 0) } });
  } catch (error: any) {
    logger.error('Error fetching highlights', 'Highlights', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:date/summary', optionalAuth, validate({
  params: {
    date: { type: 'string' as const, required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ }
  }
}), async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const startDate = new Date(`${date}T00:00:00+05:30`);
    const endDate = new Date(`${date}T23:59:59.999+05:30`);

    const [hourlyData, categoryResult] = await Promise.all([
      AppDataSource.query(`SELECT EXTRACT(HOUR FROM e.timestamp) as hour, COUNT(*) as count FROM events e WHERE e.timestamp BETWEEN $1 AND $2 AND e.event_type IN ('motion', 'face', 'event_motion', 'event_face') GROUP BY EXTRACT(HOUR FROM e.timestamp) ORDER BY hour`, [startDate, endDate]),
      AppDataSource.query(`SELECT COUNT(*) as total, SUM(e.persons_detected) as total_persons, SUM(e.faces_detected) as total_faces, SUM(e.known_faces_count) as total_known_faces, COUNT(CASE WHEN EXTRACT(HOUR FROM e.timestamp) BETWEEN 22 AND 6 THEN 1 END) as night_events FROM events e WHERE e.timestamp BETWEEN $1 AND $2 AND e.event_type IN ('motion', 'face', 'event_motion', 'event_face')`, [startDate, endDate])
    ]);

    const hourly = Array.from({ length: 24 }, (_, i) => { const f = hourlyData.find((h: any) => parseInt(h.hour) === i); return { hour: i, count: f ? parseInt(f.count) : 0 }; });
    res.json({ success: true, date, summary: { totalEvents: parseInt(categoryResult[0].total), totalPersons: parseInt(categoryResult[0].total_persons) || 0, totalFaces: parseInt(categoryResult[0].total_faces) || 0, knownFaces: parseInt(categoryResult[0].total_known_faces) || 0, nightEvents: parseInt(categoryResult[0].night_events) || 0 }, hourly });
  } catch (error: any) {
    logger.error('Error fetching highlights summary', 'Highlights', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
