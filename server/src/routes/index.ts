import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { StreamManager, Camera, streamManager } from '../streams/rtspManager.js';
import { validate, commonSchemas } from '../middleware/validation.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { requireUser, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import auditLogger from '../utils/auditLogger.js';
// import logRoutes from './logRoutes.js';
import { generateTestJpegFrame } from '../utils/testImageGenerator.js';
import { AppDataSource } from '../database.js';
import { Event } from '../models/Event.js';
import { FindManyOptions } from 'typeorm';
import { config, CameraConfig } from '../config/index.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { batchProcessingService } from '../services/batchProcessingService.js';
import { getBatchProcessingDatabase } from '../services/batchProcessingDatabasePostgres.js';
import { getDetectionsPath, getEventPath } from '../config/index.js';
import { DetectionDataNormalizer } from '../utils/detectionDataNormalizer.js';
import detectionRoutes from './detectionRoutes.js';
import { configureDetectionRedoRoutes } from './detectionRedoRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import faceEmbeddingRoutes from './faceEmbeddingRoutes.js';
import faceConfigRoutes from './faceConfigRoutes.js';
import eventSearchService from '../services/eventSearchService.js';
import { AutomatedCleanupService } from '../services/automatedCleanupService.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { inMemoryState } from '../services/inMemoryStateService.js';
import multer from 'multer';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Camera ID validation regex - only allows alphanumeric, underscore, hyphen
const CAMERA_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Validate cameraId parameter
function validateCameraId(cameraId: string): boolean {
  return CAMERA_ID_PATTERN.test(cameraId) && cameraId.length <= 100;
}

// Validate and sanitize cameraId, return error response if invalid
function validateCameraIdParam(cameraId: string, res: Response): boolean {
  if (!cameraId || !validateCameraId(cameraId)) {
    res.status(400).json({
      success: false,
      error: 'Invalid camera ID format'
    });
    return false;
  }
  return true;
}

// Log route configuration
logger.info('Configuring main API routes', 'ROUTES');

// In-memory state (recentEvents, alerts, cachedSystemSettings) moved to InMemoryStateService
// See: server/src/services/inMemoryStateService.ts
// Types (MotionEvent, Alert, SystemSettings) are exported from inMemoryStateService

// Helper function to parse timestamp from filename
const parseTimestampFromFilename = (filename: string): number => {
  const parts = filename.split('_');
  if (parts.length >= 3) {
    const timestampPart = parts[2]?.split('.')[0]; // e.g., "2025-06-29T07-24-23-640Z" or "1763535628378"
    if (timestampPart) {
      // Check if timestampPart is a numeric timestamp (like 1763535628378 or 1763535628378Z)
      // Unix timestamps in milliseconds for 2025 would be ~1700000000000+ (much larger than 9999)
      // Strip 'Z' suffix if present for numeric check
      const cleanTimestampPart = timestampPart.replace(/Z$/, '');
      const numericTimestamp = parseInt(cleanTimestampPart, 10);
      if (!isNaN(numericTimestamp) && /^\d+$/.test(cleanTimestampPart) && cleanTimestampPart.length > 4) {
        // It's a numeric timestamp in milliseconds (not just a year like 2025)
        const parsedDate = new Date(numericTimestamp);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.getTime();
        }
      } else {
        // It's in the format YYYY-MM-DDTHH-mm-ss-msZ
        // Convert "YYYY-MM-DDTHH-mm-ss-msZ" to "YYYY-MM-DDTHH:mm:ss.msZ"
        if (timestampPart.includes('T')) { // Contains date-time separator
          const [datePart, timePartWithZ] = timestampPart.split('T');
          if (datePart && timePartWithZ) {
            const timeParts = timePartWithZ.split('-'); // ["HH", "mm", "ss", "msZ"]

            let ms = 0;
            let formattedTime = '';

            if (timeParts.length === 4) {
              // Has milliseconds
              ms = parseInt(timeParts[3].replace('Z', ''), 10);
              formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}.${ms}Z`;
            } else if (timeParts.length === 3) {
              // No separate milliseconds, the last part might have Z
              if (timeParts[2].includes('Z')) {
                formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2].replace('Z', '')}Z`;
              } else {
                formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}Z`;
              }
            } else {
              console.warn(`Unexpected time format in filename: ${timestampPart}`);
              return 0;
            }

            const isoTimestamp = `${datePart}T${formattedTime}`;
            const parsedDate = new Date(isoTimestamp);

            if (!isNaN(parsedDate.getTime())) {
              return parsedDate.getTime();
            } else {
              console.warn(`Failed to parse timestamp from filename: ${timestampPart}. Using current time.`);
            }
          }
        }
      }
    }
  }
  return 0; // Return 0 or handle error appropriately
};

// Helper function to get current stream manager
function getStreamManager() {
  return serviceRegistry.getStreamManager();
}

function getMotionDetector() {
  return serviceRegistry.getMotionDetector();
}

function getObjectDetectionService() {
  // Legacy — no longer used; returns undefined for backward compatibility
  return undefined;
}

function getFacialRecognitionService() {
  // Legacy — no longer used; returns undefined for backward compatibility
  return undefined;
}

// Routes configuration
export function configureRoutes(app: Express, io: SocketIOServer) {
  
  // Add motion event listener
  const handleMotionDetected = (event: { id: string; cameraId: string; timestamp: string; imagePath: string; confidence: number; duration: number; cameraName?: string; labels?: string[]; location?: string }) => {
    // Motion event log disabled
    // Add to recent events via in-memory state service
    inMemoryState.addRecentEvent(event);

    // Add an alert for motion detection
    inMemoryState.addAlert({
      type: 'motion',
      severity: 'warning',
      message: `Motion detected on camera ${event.cameraName || event.cameraId}`,
      cameraId: event.cameraId,
    });
  };
  
  io.on('motionDetected', handleMotionDetected);

  // API endpoints
  
  // Get all alerts
  app.get('/api/alerts', requireUser, (req: Request, res: Response) => {
    try {
      res.json({ success: true, alerts: inMemoryState.getAlerts() });
    } catch (error) {
      console.error('Error getting alerts:', error);
      res.status(500).json({ success: false, error: 'Failed to get alerts' });
    }
  });

  // Acknowledge an alert
  app.post('/api/alerts/:id/acknowledge', requireUser, (req: Request, res: Response) => {
    try {
      const alertId = req.params.id;
      const acknowledged = inMemoryState.acknowledgeAlert(alertId);
      if (!acknowledged) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error) {
      console.error(`Error acknowledging alert ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
    }
  });

  // Delete an alert
  app.delete('/api/alerts/:id', requireUser, (req: Request, res: Response) => {
    try {
      const alertId = req.params.id;
      const deleted = inMemoryState.deleteAlert(alertId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
      console.error(`Error deleting alert ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to delete alert' });
    }
  });

  // Get historical motion events with pagination and filtering (database-based implementation)
  app.get('/api/events/history', optionalAuth, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100); // Max 100 per page
      const cameraIdFilter = req.query.cameraId as string;
      const searchQuery = req.query.searchQuery as string;
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      const sortBy = req.query.sortBy as string || 'newest';
      const detectionType = req.query.detectionType as string || 'all';

      // Build query conditions
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Add file type filter for events
      conditions.push("e.event_type IN ('event_motion', 'event_face')");

      // Camera filter
      if (cameraIdFilter && cameraIdFilter !== 'all') {
        conditions.push(`e.camera_id = $${paramIndex++}`);
        values.push(cameraIdFilter);
      }

      // Detection type filter
      if (detectionType && detectionType !== 'all') {
        if (detectionType === 'face') {
          conditions.push(`e.event_type = 'event_face'`);
        } else if (detectionType === 'motion' || detectionType === 'person') {
          conditions.push(`e.event_type = 'event_motion'`);
        }
      }

      // Date range filter
      if (startDateStr) {
        conditions.push(`e.timestamp >= $${paramIndex++}`);
        values.push(new Date(startDateStr));
      }
      if (endDateStr) {
        conditions.push(`e.timestamp <= $${paramIndex++}`);
        values.push(new Date(endDateStr));
      }
 
      // Search query filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        conditions.push(`(e.camera_id ILIKE $${paramIndex++} OR e.file_path ILIKE $${paramIndex++})`);
        values.push(`%${searchLower}%`, `%${searchLower}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = sortBy === 'oldest' ? 'ORDER BY e.timestamp ASC' : 'ORDER BY e.timestamp DESC';

      // Count total events for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        ${whereClause}
      `;
      const countResult = await AppDataSource.query(countQuery, values);
      const totalEvents = parseInt(countResult[0].total);

      // Get paginated events
      const offset = (page - 1) * pageSize;
      const eventsQuery = `
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as id,
          COALESCE(df.camera_id, e.camera_id) as cameraId,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp,
          COALESCE(df.storage_path, e.file_path) as imagePath,
          COALESCE(df.metadata, e.metadata) as metadata,
          COALESCE(df.file_type, e.event_type) as file_type
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;
      values.push(pageSize, offset);

      const results = await AppDataSource.query(eventsQuery, values);

      // Transform results to match expected format
      const events = results.map((row: any) => {
        // Parse metadata if it's a string
        let metadata = row.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = {};
          }
        }

        // Extract confidence from metadata if available, otherwise default to 0.75
        let confidence = 0.75;
        if (metadata && typeof metadata === 'object') {
          if (metadata.confidence !== undefined) {
            confidence = metadata.confidence;
          } else if (metadata.persons && metadata.persons.length > 0) {
            confidence = metadata.persons[0].confidence || 0.75;
          } else if (metadata.faces && metadata.faces.length > 0) {
            confidence = metadata.faces[0].confidence || 0.75;
          }
        }

        // Normalize confidence to 0-1 range if it's in 0-100 range (greater than 1)
        if (confidence > 1) {
          confidence = confidence / 100;
        }

        // Determine labels from event type
        let labels = ['motion'];
        if (row.file_type === 'face') {
          labels = ['face'];
        } else if (row.file_type === 'motion') {
          labels = ['motion'];
        }

        // Extract just the filename from the full path for frontend compatibility
        let imagePathForFrontend = row.imagepath;
        if (row.imagepath) {
          const pathParts = row.imagepath.split('/');
          imagePathForFrontend = pathParts[pathParts.length - 1];
        }

        return {
          id: row.id,
          cameraId: row.cameraid || 'unknown',
          timestamp: new Date(row.timestamp).toISOString(),
          imagePath: imagePathForFrontend,
          imageUrl: `/events/${imagePathForFrontend}`,
          confidence: confidence,
          labels: labels,
          location: `Camera ${row.cameraid || 'unknown'}`,
          duration: 0,
          cameraName: `Camera ${row.cameraid || 'unknown'}`,
          event_type: row.file_type
        };
      });

      const totalPages = Math.ceil(totalEvents / pageSize);

      res.json({
        success: true,
        events: events,
        pagination: {
          totalEvents,
          totalPages,
          currentPage: page,
          pageSize,
        },
      });
    } catch (error) {
      console.error('Error getting historical events:', error);
      res.status(500).json({ success: false, error: 'Failed to get historical events' });
    }
  });

  // Get motion events for a specific camera (using in-memory state service)
  app.get('/api/motion/:cameraId/events', optionalAuth, (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const events = inMemoryState.getRecentEvents()
        .filter(event => event.cameraId === req.params.cameraId)
        .slice(0, limit);
      res.json({ success: true, events });
    } catch (error) {
      console.error(`Error getting motion events for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get motion events' });
    }
  });

  // Search events (database-based implementation)
  app.get('/api/events/search', optionalAuth, async (req: Request, res: Response) => {
    try {
      const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        cameraId: req.query.cameraId as string,
        eventType: req.query.eventType as string,
        confidence: req.query.confidence as string,
        faceStatus: req.query.faceStatus as string,
        page: parseInt(req.query.page as string) || 1,
        pageSize: Math.min(parseInt(req.query.pageSize as string) || 20, 100),
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' as const : 'DESC' as const,
      };

      const result = await eventSearchService.searchEvents(filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error searching events:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to search events',
      });
    }
  });

  app.get('/api/events/search/legacy', optionalAuth, async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100); // Max 100 per page
      const cameraIdFilter = req.query.cameraId as string;
      const searchQuery = req.query.searchQuery as string;
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      // Build query conditions
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Add file type filter for events
      conditions.push("e.event_type IN ('event_motion', 'event_face')");

      // Camera filter
      if (cameraIdFilter && cameraIdFilter !== 'all') {
        conditions.push(`e.camera_id = $${paramIndex++}`);
        values.push(cameraIdFilter);
      }

      // Date range filter
      if (startDateStr) {
        conditions.push(`e.timestamp >= $${paramIndex++}`);
        values.push(new Date(startDateStr));
      }
      if (endDateStr) {
        conditions.push(`e.timestamp <= $${paramIndex++}`);
        values.push(new Date(endDateStr));
      }

      // Search query filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        conditions.push(`(e.camera_id ILIKE $${paramIndex++} OR e.file_path ILIKE $${paramIndex++} OR e.metadata::text ILIKE $${paramIndex++})`);
        values.push(`%${searchLower}%`, `%${searchLower}%`, `%${searchLower}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = 'ORDER BY e.timestamp DESC';

      // Count total events for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        ${whereClause}
      `;
      const countResult = await AppDataSource.query(countQuery, values);
      const totalEvents = parseInt(countResult[0].total);

      // Get paginated events
      const offset = (page - 1) * pageSize;
      const eventsQuery = `
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as id,
          COALESCE(df.camera_id, e.camera_id) as cameraId,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp,
          COALESCE(df.storage_path, e.file_path) as imagePath,
          COALESCE(df.metadata, e.metadata) as metadata
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;
      values.push(pageSize, offset);

      const results = await AppDataSource.query(eventsQuery, values);

      // Transform results to match expected format
      const events = results.map((row: any) => {
        // Extract confidence from metadata if available, otherwise default to 0.75
        let confidence = 0.75;
        if (row.metadata && typeof row.metadata === 'object') {
          if (row.metadata.confidence !== undefined) {
            confidence = row.metadata.confidence;
          } else if (row.metadata.persons && row.metadata.persons.length > 0) {
            confidence = row.metadata.persons[0].confidence || 0.75;
          } else if (row.metadata.faces && row.metadata.faces.length > 0) {
            confidence = row.metadata.faces[0].confidence || 0.75;
          }
        }

        // Normalize confidence to 0-1 range if it's in 0-100 range (greater than 1)
        if (confidence > 1) {
          confidence = confidence / 100;
        }

        // Determine labels from file type
        let labels = ['motion'];
        if (row.file_type === 'event_face') {
          labels = ['face'];
        } else if (row.file_type === 'event_motion') {
          labels = ['motion'];
        }

        // Extract just the filename from the full path for frontend compatibility
        // The imagePath from DB is like: /data/detections/2026-01/events/motion/motion_cam2_2026-01-09T11-41-14-272Z.jpg
        // We need to extract the filename part: motion_cam2_2026-01-09T11-41-14-272Z.jpg
        // Note: PostgreSQL converts column aliases to lowercase, so use imagepath instead of imagePath
        let imagePathForFrontend = row.imagepath;
        if (row.imagepath) {
          const pathParts = row.imagepath.split('/');
          imagePathForFrontend = pathParts[pathParts.length - 1];
        }

        return {
          id: row.id,
          cameraId: row.cameraid || 'unknown',
          timestamp: new Date(row.timestamp).toISOString(),
          imagePath: imagePathForFrontend,
          imageUrl: `/events/${imagePathForFrontend}`,
          confidence: confidence,
          labels: labels,
          location: `Camera ${row.cameraid || 'unknown'}`,
          duration: 0,
          cameraName: `Camera ${row.cameraid || 'unknown'}`
        };
      });

      const totalPages = Math.ceil(totalEvents / pageSize);

      res.json({
        success: true,
        events: events,
        pagination: {
          totalEvents,
          totalPages,
          currentPage: page,
          pageSize,
        },
      });
    } catch (error) {
      console.error('Error searching events:', error);
      res.status(500).json({ success: false, error: 'Failed to search events' });
    }
  });

  // Get all motion events (what the frontend expects) - database-based implementation
  app.get('/api/motion/events', optionalAuth, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000); // Max 1000 per request

      // Query events from database
      const query = `
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as id,
          COALESCE(df.camera_id, e.camera_id) as cameraId,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp,
          COALESCE(df.storage_path, e.file_path) as imagePath,
          COALESCE(df.metadata, e.metadata) as metadata
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE COALESCE(df.file_type, e.event_type) IN ('event_motion', 'event_face')

        ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC
        LIMIT $1
      `;

      const results = await AppDataSource.query(query, [limit]);

      // Transform results to match expected format
      const events = results.map((row: any) => {
        // Extract confidence from metadata if available, otherwise default to 0.75
        let confidence = 0.75;
        if (row.metadata && typeof row.metadata === 'object') {
          if (row.metadata.confidence !== undefined) {
            confidence = row.metadata.confidence;
          } else if (row.metadata.persons && row.metadata.persons.length > 0) {
            confidence = row.metadata.persons[0].confidence || 0.75;
          } else if (row.metadata.faces && row.metadata.faces.length > 0) {
            confidence = row.metadata.faces[0].confidence || 0.75;
          }
        }

        // Normalize confidence to 0-1 range if it's in 0-100 range (greater than 1)
        if (confidence > 1) {
          confidence = confidence / 100;
        }

        // Determine labels from file type
        let labels = ['motion'];
        if (row.file_type === 'event_face') {
          labels = ['face'];
        } else if (row.file_type === 'event_motion') {
          labels = ['motion'];
        }

        // Extract just the filename from the full path for frontend compatibility
        // The imagePath from DB is like: /data/detections/2026-01/events/motion/motion_cam2_2026-01-09T11-41-14-272Z.jpg
        // We need to extract the filename part: motion_cam2_2026-01-09T11-41-14-272Z.jpg
        // Then format it as an API endpoint for the frontend
        // Note: PostgreSQL converts column aliases to lowercase, so use imagepath instead of imagePath
        let imagePathForFrontend = row.imagepath;
        if (row.imagepath) {
          const pathParts = row.imagepath.split('/');
          const filename = pathParts[pathParts.length - 1];
          // Format as API endpoint that serves the image from the detection directory
          imagePathForFrontend = `/events/${filename}`;
        }

        return {
          id: row.file_uuid,
          cameraId: row.camera_id || 'unknown',
          timestamp: row.capture_timestamp ? new Date(row.capture_timestamp).toISOString() : new Date().toISOString(),
          imagePath: row.storage_path,
          confidence: confidence,
          duration: 0, // Default duration, could be calculated from metadata if needed
          cameraName: row.camera_id, // Use camera_id as cameraName
          labels: [], // Could extract from metadata if needed
          location: 'Unknown' // Could extract from metadata if needed
        };
      });

      res.json({ success: true, events: events });
    } catch (error) {
      console.error('Error getting motion events:', error);
      res.status(500).json({ success: false, error: 'Failed to get motion events' });
    }
  });

  // Get motion events for a specific camera - database-based implementation
  app.get('/api/motion/:cameraId/events', optionalAuth, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 1000); // Max 1000 per request
      const cameraId = req.params.cameraId;

      // Query events from database for this specific camera
      const query = `
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as id,
          COALESCE(df.camera_id, e.camera_id) as cameraId,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp,
          COALESCE(df.storage_path, e.file_path) as imagePath,
          COALESCE(df.metadata, e.metadata) as metadata
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE COALESCE(df.file_type, e.event_type) IN ('event_motion', 'event_face')
          AND COALESCE(df.camera_id, e.camera_id) = $1

        ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC
        LIMIT $2
      `;

      const results = await AppDataSource.query(query, [cameraId, limit]);

      // Transform results to match expected format
      const events = results.map((row: any) => {
        // Extract confidence from metadata if available, otherwise default to 0.75
        let confidence = 0.75;
        if (row.metadata && typeof row.metadata === 'object') {
          if (row.metadata.confidence !== undefined) {
            confidence = row.metadata.confidence;
          } else if (row.metadata.persons && row.metadata.persons.length > 0) {
            confidence = row.metadata.persons[0].confidence || 0.75;
          } else if (row.metadata.faces && row.metadata.faces.length > 0) {
            confidence = row.metadata.faces[0].confidence || 0.75;
          }
        }

        // Normalize confidence to 0-1 range if it's in 0-100 range (greater than 1)
        if (confidence > 1) {
          confidence = confidence / 100;
        }

        // Determine labels from file type
        let labels = ['motion'];
        if (row.file_type === 'event_face') {
          labels = ['face'];
        } else if (row.file_type === 'event_motion') {
          labels = ['motion'];
        }

        // Extract just the filename from the full path for frontend compatibility
        // The imagePath from DB is like: /data/detections/2026-01/events/motion/motion_cam2_2026-01-09T11-41-14-272Z.jpg
        // We need to extract the filename part: motion_cam2_2026-01-09T11-41-14-272Z.jpg
        // Then format it as an API endpoint for the frontend
        // Note: PostgreSQL converts column aliases to lowercase, so use imagepath instead of imagePath
        let imagePathForFrontend = row.imagepath;
        if (row.imagepath) {
          const pathParts = row.imagepath.split('/');
          const filename = pathParts[pathParts.length - 1];
          // Format as API endpoint that serves the image from the detection directory
          imagePathForFrontend = `/events/${filename}`;
        }

        return {
          id: row.id,
          cameraId: row.cameraid || 'unknown',
          timestamp: new Date(row.timestamp).toISOString(),
          imagePath: imagePathForFrontend,
          confidence: confidence,
          duration: 0,
           cameraName: `Camera ${row.cameraid || 'unknown'}`,
           labels: labels,
           location: `Camera ${row.cameraid || 'unknown'}`,
           imageUrl: imagePathForFrontend
         };
      });

      res.json({ success: true, events: events });
    } catch (error) {
      console.error(`Error getting motion events for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get motion events' });
    }
  });

  // Archive an event
  app.post('/api/events/:id/archive', requireUser, (req: Request, res: Response) => {
    try {
      const eventId = req.params.id;
      // Note: InMemoryStateService doesn't support individual event removal
      // This endpoint is kept for API compatibility
      const events = inMemoryState.getRecentEvents();
      const eventIndex = events.findIndex(event => event.id === eventId);
      if (eventIndex === -1) {
        return res.status(404).json({ success: false, error: 'Event not found or already archived' });
      }
      res.json({ success: true, message: 'Event archived successfully' });
    } catch (error) {
      console.error(`Error archiving event ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to archive event' });
    }
  });

  // Trigger a simulated motion event (for testing)
  app.post('/api/motion/:cameraId/simulate', requireAdmin, (req: Request, res: Response) => {
    try {
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      // Trigger simulation
      streamManager.simulateMotionDetection(req.params.cameraId);
      res.json({ success: true, message: 'Motion simulation triggered' });
    } catch (error) {
      console.error(`Error simulating motion for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to simulate motion' });
    }
  });

  // Get daily event statistics
  app.get('/api/events/stats/today', optionalAuth, async (req: Request, res: Response) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const query = `
        SELECT COUNT(*) as count
        FROM events e
        WHERE e.timestamp >= $1
        AND e.event_type IN ('motion', 'face', 'event_motion', 'event_face')
      `;
      const result = await AppDataSource.query(query, [todayIso]);
      res.json({ success: true, count: parseInt(result[0].count) });
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch daily stats' });
    }
  });

  // Get event counts by date for calendar view
  app.get('/api/events/stats/calendar', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { year, month, camera_id } = req.query;
      
      const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
      const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
      
      const startDate = new Date(currentYear, currentMonth - 1, 1);
      const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
      
      let conditions = [
        "e.timestamp >= $1",
        "e.timestamp <= $2",
        "e.event_type IN ('motion', 'face', 'event_motion', 'event_face')"
      ];
      const params: any[] = [startDate.toISOString(), endDate.toISOString()];
      
      if (camera_id && camera_id !== 'all') {
        conditions.push(`e.camera_id = $${params.length + 1}`);
        params.push(camera_id);
      }
      
      const query = `
        SELECT 
          DATE(e.timestamp) as date,
          COUNT(*) as count,
          COUNT(CASE WHEN e.event_type = 'motion' OR e.event_type = 'event_motion' THEN 1 END) as motion_count,
          COUNT(CASE WHEN e.event_type = 'face' OR e.event_type = 'event_face' THEN 1 END) as face_count,
          COUNT(CASE WHEN e.persons_detected > 0 THEN 1 END) as person_count,
          SUM(e.persons_detected) as total_persons,
          AVG(e.confidence) as avg_confidence
        FROM events e
        WHERE ${conditions.join(' AND ')}
        GROUP BY DATE(e.timestamp)
        ORDER BY date
      `;
      
      const results = await AppDataSource.query(query, params);
      
      // Convert to calendar format
      const calendarData: Record<string, { count: number; motion: number; face: number; persons: number; avgConfidence: number }> = {};
      results.forEach((row: any) => {
        const dateKey = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0];
        calendarData[dateKey] = {
          count: parseInt(row.count),
          motion: parseInt(row.motion_count) || 0,
          face: parseInt(row.face_count) || 0,
          persons: parseInt(row.total_persons) || 0,
          avgConfidence: parseFloat(row.avg_confidence) || 0
        };
      });
      
      res.json({ 
        success: true, 
        data: calendarData,
        summary: {
          totalEvents: results.reduce((acc: number, r: any) => acc + parseInt(r.count), 0),
          totalPersons: results.reduce((acc: number, r: any) => acc + (parseInt(r.total_persons) || 0), 0),
          avgConfidence: results.length > 0 
            ? results.reduce((acc: number, r: any) => acc + parseFloat(r.avg_confidence || 0), 0) / results.length 
            : 0
        }
      });
    } catch (error) {
      console.error('Error fetching calendar stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch calendar stats' });
    }
  });

  // Get event summary for date range (for quick stats)
  app.get('/api/events/stats/range', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { start_date, end_date, camera_id } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({ success: false, error: 'Start and end dates required' });
      }
      
      const start = new Date(start_date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(end_date as string);
      end.setHours(23, 59, 59, 999);
      
      let conditions = [
        "e.timestamp >= $1",
        "e.timestamp <= $2",
        "e.event_type IN ('motion', 'face', 'event_motion', 'event_face')"
      ];
      const params: any[] = [start.toISOString(), end.toISOString()];
      
      if (camera_id && camera_id !== 'all') {
        conditions.push(`e.camera_id = $${params.length + 1}`);
        params.push(camera_id);
      }
      
      const query = `
        SELECT 
          COUNT(*) as total_count,
          COUNT(CASE WHEN e.event_type = 'motion' OR e.event_type = 'event_motion' THEN 1 END) as motion_count,
          COUNT(CASE WHEN e.event_type = 'face' OR e.event_type = 'event_face' THEN 1 END) as face_count,
          SUM(e.persons_detected) as total_persons,
          SUM(e.faces_detected) as total_faces,
          SUM(e.known_faces_count) as known_faces,
          SUM(e.unknown_faces_count) as unknown_faces,
          AVG(e.confidence) as avg_confidence
        FROM events e
        WHERE ${conditions.join(' AND ')}
      `;
      
      const result = await AppDataSource.query(query, params);
      const row = result[0];
      
      res.json({
        success: true,
        stats: {
          totalEvents: parseInt(row.total_count) || 0,
          motionEvents: parseInt(row.motion_count) || 0,
          faceEvents: parseInt(row.face_count) || 0,
          totalPersons: parseInt(row.total_persons) || 0,
          totalFaces: parseInt(row.total_faces) || 0,
          knownFaces: parseInt(row.known_faces) || 0,
          unknownFaces: parseInt(row.unknown_faces) || 0,
          avgConfidence: parseFloat(row.avg_confidence) || 0
        }
      });
    } catch (error) {
      console.error('Error fetching range stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch range stats' });
    }
  });

  // List event images
  app.get('/api/events/list', optionalAuth, async (req: Request, res: Response) => {
    try {
      // Query event files directly from events table
      // Avoid expensive JOIN with detection_files (LIKE condition can't use indexes)
      const query = `
        SELECT e.file_path, e.timestamp
        FROM events e
        WHERE e.event_type IN ('motion', 'face', 'event_motion', 'event_face')
        ORDER BY e.timestamp DESC
        LIMIT 1000
      `;

      const results = await AppDataSource.query(query);

      // Transform results to match expected format (extract filename from path)
      const files = results.map((row: any) => {
        const pathParts = row.file_path.split('/');
        return pathParts[pathParts.length - 1];
      });

      res.json({ success: true, files });
    } catch (error) {
      console.error('Error listing events:', error);
      res.status(500).json({ success: false, error: 'Failed to list events' });
    }
  });

  // NEW: Enhanced events list with detection data from events table
  app.get('/api/events/list-enhanced', optionalAuth, async (req: Request, res: Response) => {
    try {
      const {
        limit,
        page = 1,
        pageSize = 100,
        event_type,
        camera_id,
        start_date,
        end_date,
        searchQuery,
        sortBy = 'newest',
        min_confidence,
        max_confidence,
        face_status
      } = req.query;

      // Use limit if provided (for backward compatibility), otherwise use pagination
      const size = limit ? parseInt(limit as string) : parseInt(pageSize as string);
      const currentPage = parseInt(page as string);
      const offset = (currentPage - 1) * size;

      const conditions: string[] = ["e.event_type IN ('motion', 'face', 'event_motion', 'event_face')"];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (camera_id && camera_id !== 'all') {
        conditions.push(`e.camera_id = $${paramIndex}`);
        queryParams.push(camera_id);
        paramIndex++;
      }

      // Date filter - handle single date or date range
      if (start_date && end_date) {
        // Use provided ISO strings directly
        const startStr = (start_date as string).replace(' 00:00:00', '');
        const endStr = (end_date as string).replace(' 23:59:59', '');
        
        conditions.push(`e.timestamp >= $${paramIndex} AND e.timestamp <= $${paramIndex + 1}`);
        queryParams.push(startStr, endStr);
        paramIndex += 2;
      } else if (start_date) {
        const startStr = (start_date as string).replace(' 00:00:00', '');
        conditions.push(`e.timestamp >= $${paramIndex}::timestamp AND e.timestamp < ($${paramIndex}::timestamp + interval '1 day')`);
        queryParams.push(startStr);
        paramIndex += 1;
      } else if (end_date) {
        const endStr = (end_date as string).replace(' 23:59:59', '');
        conditions.push(`e.timestamp <= $${paramIndex}::timestamp`);
        queryParams.push(endStr);
        paramIndex++;
      }

      // Search query filter
      if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase().trim();
        conditions.push(`(e.camera_id ILIKE $${paramIndex} OR e.file_path ILIKE $${paramIndex})`);
        queryParams.push(`%${searchLower}%`);
        paramIndex++;
      }

      // Detection type filter (event_type)
      if (event_type && typeof event_type === 'string' && event_type !== 'all') {
        if (event_type === 'face') {
          conditions.push(`e.event_type IN ('face', 'event_face')`);
        } else if (event_type === 'motion' || event_type === 'person') {
          conditions.push(`e.event_type IN ('motion', 'event_motion')`);
        }
      }

      // Confidence filter
      if (min_confidence && typeof min_confidence === 'string') {
        conditions.push(`(COALESCE(e.confidence, 0) >= $${paramIndex})`);
        queryParams.push(parseFloat(min_confidence));
        paramIndex++;
      }
      if (max_confidence && typeof max_confidence === 'string') {
        conditions.push(`(COALESCE(e.confidence, 0) <= $${paramIndex})`);
        queryParams.push(parseFloat(max_confidence));
        paramIndex++;
      }

      // Face status filter
      if (face_status && typeof face_status === 'string' && face_status !== 'all') {
        switch (face_status) {
          case 'has_faces':
            conditions.push(`COALESCE(e.faces_detected, 0) > 0`);
            break;
          case 'known_faces':
            conditions.push(`COALESCE(e.known_faces_count, 0) > 0`);
            break;
          case 'unknown_faces':
            conditions.push(`COALESCE(e.unknown_faces_count, 0) > 0`);
            break;
          case 'no_faces':
            conditions.push(`(COALESCE(e.faces_detected, 0) = 0)`);
            break;
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Sort order based on sortBy parameter
      // Use COALESCE to fall back to metadata detected_at when capture_timestamp is NULL
      const orderClause = sortBy === 'oldest'
        ? 'ORDER BY COALESCE(e.timestamp, (e.metadata::jsonb->>\'detected_at\')::timestamp) ASC'
        : 'ORDER BY COALESCE(e.timestamp, (e.metadata::jsonb->>\'detected_at\')::timestamp) DESC';

        // Count total events for pagination
        let totalEvents = 0;
        let totalPages = 0;
        let results = [];

        try {
          const countQuery = `
            SELECT COUNT(*) as total
            FROM events e
            ${whereClause}
          `;

          // We need a separate parameter array for count query because it uses the same WHERE clause
          // but doesn't need LIMIT/OFFSET params
          const countResult = await AppDataSource.query(countQuery, queryParams);
          totalEvents = parseInt(countResult[0].total);
          totalPages = Math.ceil(totalEvents / size);

          // Query events table to get all event files
          let detectionQuery = `
            SELECT
              e.id as id,
              e.file_path as filename,
              e.file_path as imagePath,
              e.camera_id as camera_id,
              e.timestamp as timestamp,
              e.event_type as file_type,
              e.metadata as metadata,
              e.confidence as confidence,
              e.persons_detected as persons_detected,
              e.faces_detected as faces_detected,
              e.known_faces_count as known_faces_count,
              e.unknown_faces_count as unknown_faces_count,
              e.object_detections as object_detections,
              e.face_detections as face_detections
            FROM events e
            ${whereClause}
            ${orderClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
          `;

          // Add pagination params
          queryParams.push(size, offset);

          results = await AppDataSource.query(detectionQuery, queryParams);
        } catch (dbError) {
          console.error('Database error in enhanced events endpoint:', dbError);
          // Return empty results if database query fails
          totalEvents = 0;
          totalPages = 0;
          results = [];
        }

      console.log(`[EventsList] Found ${results.length} events (Page ${currentPage} of ${totalPages})`);

      // Transform results to match expected format
      const events = results.map((row: any) => {
        // Extract detection data from metadata
        let metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};

        // Extract detection counts from metadata
        let persons_detected = metadata.personCount || metadata.persons?.length || 0;
        let faces_detected = metadata.faceCount || metadata.faces?.length || 0;
        let known_faces_count = metadata.knownFaces || 0;
        let unknown_faces_count = metadata.unknownFaces || 0;

        // Extract detection arrays from metadata
        let object_detections = metadata.detections || metadata.persons || [];
        let face_detections = metadata.faces || [];

        // Extract just the filename from the full path for frontend compatibility
        // Use the API endpoint format that serves images from the detection directory
        const filename = path.basename(row.filename);
        let imageUrl = `/api/events/image/${filename}`;

        const eventData = {
          id: row.id, // Use actual UUID from database
          event_type: row.file_type === 'event_face' ? 'face' : 'motion',
          filename: filename,
          timestamp: row.timestamp,
          cameraId: row.camera_id,
          confidence: metadata.confidence || 0,
          metadata: metadata,
          imageUrl: imageUrl, // Add imageUrl field for frontend

          // Detection data extracted from metadata
          persons_detected,
          faces_detected,
          known_faces_count,
          unknown_faces_count,
          object_detections: object_detections || [],
          face_detections: face_detections || [],
        };

        console.log('Returning eventData with keys:', Object.keys(eventData));
        return eventData;
      });

      res.json({
        success: true,
        events,
        pagination: {
          totalEvents,
          totalPages,
          currentPage,
          pageSize: size
        }
      });
    } catch (error) {
      console.error('Failed to fetch events:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      res.status(500).json({ success: false, error: 'Failed to fetch events' });
    }
  });

  // NEW: Get event details with detection data
  app.get('/api/events/:id/details', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const eventRepository = AppDataSource.getRepository(Event);
      const event = await eventRepository.findOne({ where: { id } });

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const filename = event.file_path.split('/').pop();
      
      let persons_detected = event.persons_detected || 0;
      let faces_detected = event.faces_detected || 0;
      let known_faces_count = event.known_faces_count || 0;
      let unknown_faces_count = event.unknown_faces_count || 0;
      let object_detections = event.object_detections;
      let face_detections = event.face_detections;

      // If events table doesn't have detection data, check processed_images table
      if (persons_detected === 0 && faces_detected === 0 && filename) {
        try {
          const processedQuery = `
            SELECT person_count, face_count, known_face_count, unknown_face_count, detection_json
            FROM processed_images
            WHERE filename = $1 AND status = 'success'
            ORDER BY processed_at DESC
            LIMIT 1
          `;
          const processedResults = await AppDataSource.query(processedQuery, [filename]);
          
          if (processedResults.length > 0) {
            const processed = processedResults[0];
            persons_detected = processed.person_count || 0;
            faces_detected = processed.face_count || 0;
            known_faces_count = processed.known_face_count || 0;
            unknown_faces_count = processed.unknown_face_count || 0;
            
            try {
              const detectionData = typeof processed.detection_json === 'string' 
                ? JSON.parse(processed.detection_json)
                : processed.detection_json;
              
              object_detections = detectionData.persons || [];
              face_detections = detectionData.faces || [];
            } catch {
              object_detections = [];
              face_detections = [];
            }
          }
        } catch (error) {
          console.error('Error querying processed_images:', error);
        }
      }

      // Normalize detection data
      const normalizedData = DetectionDataNormalizer.createDetectionStorageFormat(
        object_detections || [],
        face_detections || []
      );

      console.log(`[EventDetails] Event ${id}:`, {
        persons_detected: normalizedData.persons_detected,
        faces_detected: normalizedData.faces_detected,
        objects: normalizedData.object_detections.length,
        faces: normalizedData.face_detections.length
      });

      // Enrich with detection data
      const result = {
        success: true,
        event: {
          id: event.id,
          event_type: event.event_type,
          filename: filename,
          timestamp: event.timestamp,
          cameraId: event.camera_id,
          confidence: event.confidence || 0,
          metadata: event.metadata ? JSON.parse(event.metadata) : null,
          
          // Detection details (normalized)
          persons_detected: normalizedData.persons_detected,
          faces_detected: normalizedData.faces_detected,
          known_faces_count: normalizedData.known_faces_count,
          unknown_faces_count: normalizedData.unknown_faces_count,
          object_detections: normalizedData.object_detections,
          face_detections: normalizedData.face_detections,
        }
      };

      res.json(result);
    } catch (error) {
      console.error('Failed to fetch event details:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch event details' });
    }
  });

// Serve event images via API
  app.get('/api/events/image/:filename', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;

      // Security check - ensure filename is valid
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ success: false, error: 'Invalid filename' });
      }

      // First, try to find the file in the public directory (for backward compatibility)
      const publicImagePath = path.join(process.cwd(), 'public', 'events', filename);
      if (fs.existsSync(publicImagePath)) {
        console.log('Serving image from public directory:', publicImagePath);
        return res.sendFile(publicImagePath);
      }

      // If not in public, try to find it in the detection files database to get the actual path
      try {
        // Try to find by file_path ending with filename
        let query = `
          SELECT file_path as storage_path
          FROM events
          WHERE file_path LIKE $1
          LIMIT 1
        `;
        let results = await AppDataSource.query(query, [`%${filename}`]);

        // If not found by file_path, try to find by exact match
        if (results.length === 0) {
          query = `
            SELECT file_path as storage_path
            FROM events
            WHERE file_path = $1
            LIMIT 1
          `;
          results = await AppDataSource.query(query, [filename]);
        }

          if (results.length > 0 && results[0].storage_path) {
            let actualImagePath = results[0].storage_path;

            // Map host paths to container paths for volume mounts
            if (actualImagePath.startsWith('/home/barun/Documents/home-security-non-docker/data/detections/')) {
              actualImagePath = actualImagePath.replace('/home/barun/Documents/home-security-non-docker/data/detections/', '/app/data/detections/');
            }

          // Security check - ensure the path is within allowed directories
          const allowedPaths = [
            path.join(process.cwd(), 'public'),
            path.join(process.cwd(), '..', 'public'),
            '/app/data/detections',
            '/app/public',
            '/data/detections',
            // Allow host-mounted data directory for development
            '/home/barun/Documents/home-security-non-docker/data/detections'
          ];

          const isAllowedPath = allowedPaths.some(allowedPath =>
            actualImagePath.startsWith(allowedPath)
          );

          if (!isAllowedPath) {
            console.log('Blocked access to unauthorized path:', actualImagePath);
            return res.status(403).json({ success: false, error: 'Unauthorized file access' });
          }

          console.log('Serving image from database-stored path:', actualImagePath);

          if (fs.existsSync(actualImagePath)) {
            return res.sendFile(actualImagePath);
          } else {
            console.log('Image file not found at stored path:', actualImagePath);
          }
        }
      } catch (dbError) {
        console.error('Error querying database for image path:', dbError);
        // Continue to try other locations
      }

      // If not found in database, try common detection paths based on current date
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const yearMonth = `${year}-${month}`;

      const possiblePaths = [
        path.join(process.cwd(), 'data', 'detections', yearMonth, 'events', 'motion', filename),
        path.join(process.cwd(), 'data', 'detections', yearMonth, 'events', 'faces', filename),
        path.join(process.cwd(), '..', 'data', 'detections', yearMonth, 'events', 'motion', filename),
        path.join(process.cwd(), '..', 'data', 'detections', yearMonth, 'events', 'faces', filename),
        `/app/data/detections/${yearMonth}/events/motion/${filename}`,
        `/app/data/detections/${yearMonth}/events/faces/${filename}`
      ];

      for (const imagePath of possiblePaths) {
        if (fs.existsSync(imagePath)) {
          console.log('Serving image from fallback path:', imagePath);
          return res.sendFile(imagePath);
        }
      }

      // If still not found, return 404
      console.log('Image file not found in any location:', filename);
      return res.status(404).json({ success: false, error: 'Image file not found on disk' });
    } catch (error) {
      console.error('Error serving event image:', error);
      res.status(500).json({ success: false, error: 'Failed to serve image' });
    }
  });

  // List snapshots
  app.get('/api/snapshots/list', optionalAuth, async (req: Request, res: Response) => {
    try {
      // Query snapshot files from database
      const query = `
        SELECT
          COALESCE(df.storage_path, e.file_path) as file_path,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE COALESCE(df.file_type, e.event_type) = 'snapshot'
        ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC
        LIMIT 1000
      `;

      const results = await AppDataSource.query(query);

      // Transform results to match expected format (just filenames)
      const files = results.map((row: any) => row.file_path);

      res.json({ success: true, files });
    } catch (error) {
      console.error('Error listing snapshots:', error);
      res.status(500).json({ success: false, error: 'Failed to list snapshots' });
    }
  });

  // Detection image with overlays endpoint
  app.get('/detections/image/:imageId', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { imageId } = req.params;
      const { overlays } = req.query;

      // Look up the image file in the database
      const dataSource = serviceRegistry.getAppDataSource();

      // Validate imageId is UUID format to prevent path traversal (T-11-05)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageId);
      if (!isUuid && !imageId.includes('.')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid image ID format'
        });
      }

      // Include detection data when overlays requested
      const detectionFields = overlays === 'true'
        ? `COALESCE(e.object_detections, '[]') as object_detections,
           COALESCE(e.face_detections, '[]') as face_detections,`
        : '';

      // Query for detection file by UUID or filename
      const query = `
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as file_uuid,
          COALESCE(df.storage_path, e.file_path) as file_path,
          COALESCE(df.storage_path, e.file_path) as imagePath,
          COALESCE(df.metadata, e.metadata) as metadata,
          COALESCE(df.camera_id, e.camera_id) as camera_id,
          ${detectionFields}
          COALESCE(df.original_filename, e.file_path) as original_filename
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE df.file_uuid = $1
           OR e.file_path = $1
           OR df.original_filename = $1

        ORDER BY COALESCE(df.created_at, e.created_at) DESC
        LIMIT 1
      `;

      const results = await dataSource.query(query, [imageId]);

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Detection image not found'
        });
      }

      const detection = results[0];
      let imagePath = detection.storage_path;

      // If path is relative, resolve it
      if (!path.isAbsolute(imagePath)) {
        imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
      }

      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          success: false,
          error: 'Image file not found on disk'
        });
      }

      // Render overlays if requested
      if (overlays === 'true') {
        const sharp = (await import('sharp')).default;
        const objectDetections: Array<Record<string, unknown>> =
          typeof detection.object_detections === 'string' ? JSON.parse(detection.object_detections) : (detection.object_detections || []);
        const faceDetections: Array<Record<string, unknown>> =
          typeof detection.face_detections === 'string' ? JSON.parse(detection.face_detections) : (detection.face_detections || []);

        const allDetections = [...objectDetections, ...faceDetections];

        if (allDetections.length > 0) {
          // Build SVG overlay with colored rectangles and labels
          const svgOverlays = allDetections.map((d, i) => {
            const box = (d.box || d.bounding_box || d.box) as Record<string, number> | undefined;
            if (!box) return '';
            const x = box.x ?? box.xmin ?? 0;
            const y = box.y ?? box.ymin ?? 0;
            const w = box.w ?? box.width ?? (box.xmax ? box.xmax - x : 0);
            const h = box.h ?? box.height ?? (box.ymax ? box.ymax - y : 0);
            const label = (d.label || d.class || 'unknown') as string;
            const confidence = d.confidence ? `${Math.round((d.confidence as number) * 100)}%` : '';
            const color = i % 2 === 0 ? '#00ff00' : '#ff4444';
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3"/>
<text x="${x}" y="${y - 5}" fill="${color}" font-size="16" font-family="monospace">${label} ${confidence}</text>`;
          }).filter(Boolean).join('\n');

          const svgOverlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${svgOverlays}</svg>`);

          const overlaidImage = await sharp(imagePath)
            .composite([{ input: svgOverlay, top: 0, left: 0 }])
            .jpeg({ quality: 90 })
            .toBuffer();

          res.set('Content-Type', 'image/jpeg');
          return res.send(overlaidImage);
        }
      }

      const imageUrl = `/events/${detection.original_filename}`;

      res.json({
        success: true,
        imageUrl,
        imagePath: detection.storage_path,
        metadata: detection.metadata ? JSON.parse(detection.metadata) : null,
        overlaysEnabled: overlays === 'true'
      });

    } catch (error) {
      console.error('Error getting detection image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get detection image'
      });
    }
  });

  // =====================================
  // PERSON AND FACIAL DETECTION ROUTES
  // =====================================
  
  // Manual person detection trigger
  app.post('/api/detection/person/:cameraId/trigger', requireUser, async (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;

      if (!validateCameraIdParam(cameraId, res)) {
        return;
      }

      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      if (!camera.isActive) {
        return res.status(400).json({ success: false, error: 'Camera is not active' });
      }
      
      // Get current frame from camera
      const currentFrame = streamManager.getCurrentFrame(cameraId);
      if (!currentFrame) {
        return res.status(400).json({ success: false, error: 'No frame available from camera' });
      }
      
      // Use consolidatedDetectionService for detection
      const { detections } = await consolidatedDetectionService.detectObjects(cameraId, currentFrame);

      // Process detection results
      const persons = detections.filter((d: any) => d.class === 'person') || [];
      
      if (persons.length > 0) {
        // Emit person detection event
        io.emit('personDetected', {
          cameraId,
          timestamp: new Date().toISOString(),
          persons: persons.map((p: any) => ({
            confidence: p.confidence,
            boundingBox: p.bbox,
            timestamp: new Date().toISOString()
          })),
          imagePath: currentFrame // In real implementation, save the frame
        });
        
        // Add alert for person detection
        inMemoryState.addAlert({
          type: 'motion',
          severity: 'warning',
          message: `Person detected on camera ${camera.name || cameraId}`,
          cameraId
        });
      }
      
      res.json({
        success: true,
        persons: persons.length,
        detections: detections || [],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`Error triggering person detection for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to trigger person detection' });
    }
  });
  
  // Manual facial detection trigger
  app.post('/api/detection/face/:cameraId/trigger', requireUser, async (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      if (!camera.isActive) {
        return res.status(400).json({ success: false, error: 'Camera is not active' });
      }
      
      // Get current frame from camera
      const currentFrame = streamManager.getCurrentFrame(cameraId);
      if (!currentFrame) {
        return res.status(400).json({ success: false, error: 'No frame available from camera' });
      }
      
      // Use consolidatedDetectionService for face recognition
      const { faces } = await consolidatedDetectionService.detectFaces(cameraId, currentFrame);
      
      if (faces && faces.length > 0) {
        // Emit face detection event
        io.emit('faceDetected', {
          cameraId,
          timestamp: new Date().toISOString(),
          faces: faces.map((f: any) => ({
            confidence: f.confidence,
            boundingBox: f.bbox,
            personId: f.id,
            personName: f.name,
            isKnown: f.name !== 'Unknown',
            timestamp: new Date().toISOString()
          })),
          imagePath: currentFrame
        });
        
        // Add alert for face detection
        const unknownFaces = faces.filter((f: any) => f.name === 'Unknown');
        if (unknownFaces.length > 0) {
          inMemoryState.addAlert({
            type: 'motion',
            severity: 'warning',
            message: `Unknown face detected on camera ${camera.name || cameraId}`,
            cameraId
          });
        }
      }
      
      res.json({
        success: true,
        faces: faces?.length || 0,
        knownFaces: faces?.filter((f: any) => f.name !== 'Unknown').length || 0,
        unknownFaces: faces?.filter((f: any) => f.name === 'Unknown').length || 0,
        detections: faces || [],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`Error triggering face detection for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to trigger face detection' });
    }
  });
  
  // Get person detection settings
  app.get('/api/detection/person/settings', optionalAuth, (req: Request, res: Response) => {
    try {
      const objectDetectionService = consolidatedDetectionService;
      const settings = objectDetectionService.getObjectDetectionSettings('default');
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error getting person detection settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get person detection settings' });
    }
  });

  // OpenCV service status endpoint
  app.get('/api/opencv/status', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { getOpenCVClient } = await import('../services/opencvMicroserviceClient.js');
      const client = getOpenCVClient();
      
      const status = await client.getStatus();
      const isHealthy = await client.checkHealth();
      
      res.json({
        success: true,
        status: status || { status: 'error', initialized: false, service: 'opencv-detection' },
        healthy: isHealthy,
        serviceUrl: client.getServiceUrl()
      });
    } catch (error) {
      console.error('Error getting OpenCV service status:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get OpenCV service status',
        status: { status: 'error', initialized: false, service: 'opencv-detection' }
      });
    }
  });
  
  // Update person detection settings
  app.put('/api/detection/person/settings', requireUser, (req: Request, res: Response) => {
    try {
      const { minConfidence, maxDetections, targetClasses } = req.body;
      const objectDetectionService = consolidatedDetectionService;
      const updated = objectDetectionService.updateObjectDetectionSettings('default', {
        minConfidence: minConfidence || 0.5,
        maxDetections: maxDetections || 10,
        targetClasses: targetClasses || ['person', 'dog', 'cat']
      });
      
      res.json({ success: true, updated });
    } catch (error) {
      console.error('Error updating person detection settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update person detection settings' });
    }
  });
  
  // Get facial recognition settings
  app.get('/api/detection/face/settings', optionalAuth, (req: Request, res: Response) => {
    try {
      const facialRecognitionService = consolidatedDetectionService;
      const settings = facialRecognitionService.getFacialRecognitionSettings();
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error getting facial recognition settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get facial recognition settings' });
    }
  });
  
  // Update facial recognition settings
  app.put('/api/detection/face/settings', requireUser, (req: Request, res: Response) => {
    try {
      const { recognitionThreshold, minFaceSize, livenessDetection } = req.body;
      const facialRecognitionService = consolidatedDetectionService;
      const updated = facialRecognitionService.updateFacialRecognitionSettings({
        recognitionThreshold: recognitionThreshold || 0.6,
        minFaceSize: minFaceSize || 48,
        // livenessDetection: livenessDetection || false
      });
      
      res.json({ success: true, updated });
    } catch (error) {
      console.error('Error updating facial recognition settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update facial recognition settings' });
    }
  });

  // Get motion detection settings
  app.get('/api/detection/motion/settings', optionalAuth, (req: Request, res: Response) => {
    try {
      const optimizedMotionDetector = serviceRegistry.getMotionDetector();

      const { cameraId } = req.query;
      if (cameraId && typeof cameraId === 'string') {
        const settings = optimizedMotionDetector.getSettings(cameraId);
        if (!settings) {
          return res.status(404).json({ success: false, error: 'Camera not found' });
        }
        return res.json({ success: true, settings, cameraId });
      }

      const allCameras = streamManager.getAllCameras();
      const allSettings: Record<string, any> = {};
      allCameras.forEach((camera: Camera) => {
        allSettings[camera.id] = optimizedMotionDetector.getSettings(camera.id);
      });

      res.json({ success: true, settings: allSettings });
    } catch (error) {
      console.error('Error getting motion detection settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get motion detection settings' });
    }
  });

  // Update motion detection settings
  app.put('/api/detection/motion/settings', requireUser, (req: Request, res: Response) => {
    try {
      const { cameraId, sensitivity, requiredConsecutiveFrames, minContourArea, useGaussianBlur, blurKernelSize, timeZones } = req.body;
      const optimizedMotionDetector = serviceRegistry.getMotionDetector();

      if (!cameraId) {
        return res.status(400).json({ success: false, error: 'cameraId is required' });
      }

      const updates: any = {};
      if (sensitivity !== undefined) updates.sensitivity = sensitivity;
      if (requiredConsecutiveFrames !== undefined) updates.requiredConsecutiveFrames = requiredConsecutiveFrames;
      if (minContourArea !== undefined) updates.minContourArea = minContourArea;
      if (useGaussianBlur !== undefined) updates.useGaussianBlur = useGaussianBlur;
      if (blurKernelSize !== undefined) updates.blurKernelSize = blurKernelSize;
      if (timeZones !== undefined) updates.timeZones = timeZones;

      const updated = optimizedMotionDetector.updateSettings(cameraId, updates);

      if (updated) {
        res.json({ success: true, updated, cameraId });
      } else {
        res.status(404).json({ success: false, error: 'Camera not found or update failed' });
      }
    } catch (error) {
      console.error('Error updating motion detection settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update motion detection settings' });
    }
  });

   // Get known persons
   app.get('/api/detection/face/persons', optionalAuth, async (req: Request, res: Response) => {
     try {
       const facialRecognitionService = consolidatedDetectionService;
       // Note: getKnownPersons method not available in ConsolidatedDetectionService
       // Returning empty array for now
       const persons: any[] = [];
       res.json({ success: true, persons });
     } catch (error) {
       console.error('Error getting known persons:', error);
       res.status(500).json({ success: false, error: 'Failed to get known persons' });
     }
   });
  
  // Add a known person
  app.post('/api/detection/face/persons', requireUser, upload.single('image'), async (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      const file = req.file;
      
      if (!name || !file) {
        return res.status(400).json({ success: false, error: 'Name and image file are required' });
      }
      
      const facialRecognitionService = consolidatedDetectionService;
      // Note: addKnownPerson method not available in ConsolidatedDetectionService
      // This endpoint is temporarily disabled - use /api/visitors/faces/register instead
      const personName = name;
      
      res.json({
        success: false,
        error: 'Method not available - use /api/visitors/faces/register endpoint',
        code: 'METHOD_NOT_AVAILABLE'
      });
    } catch (error: any) {
      console.error('Error adding known person:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to add known person' });
    }
  });
  
  // Get known persons (alias for frontend detectionService compatibility)
  app.get('/api/detection/persons', optionalAuth, async (req: Request, res: Response) => {
    try {
      const rows = await AppDataSource.query(
        "SELECT id, name, COALESCE(embedding_count, 0) as image_count, created_at, updated_at FROM visitors WHERE type = 'known' ORDER BY name ASC"
      );
      const persons = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        imageCount: r.image_count,
        embeddingCount: r.embedding_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      res.json({ success: true, persons });
    } catch (error) {
      console.error('Error getting known persons:', error);
      res.status(500).json({ success: false, error: 'Failed to get known persons' });
    }
  });

  // Add a known person
  app.post('/api/detection/persons', requireUser, async (req: Request, res: Response) => {
    try {
      const { name, images } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }
      const id = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AppDataSource.query(
        'INSERT INTO visitors (id, name, type, first_seen, last_seen) VALUES ($1, $2, $3, NOW(), NOW())',
        [id, name, 'known']
      );
      res.json({ success: true, personId: id, message: `Person ${name} added successfully` });
    } catch (error: any) {
      console.error('Error adding known person:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to add known person' });
    }
  });

  // Get known faces
  app.get('/api/detection/faces', optionalAuth, async (req: Request, res: Response) => {
    try {
      const rows = await AppDataSource.query(`
        SELECT v.id, v.name, v.embedding_count as image_count, v.updated_at as last_trained
        FROM visitors v
        WHERE v.type = 'known' AND v.embedding_count > 0
        ORDER BY v.name ASC
      `);
      const faces = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        imageCount: r.image_count,
        lastTrained: r.last_trained,
        personId: r.id,
      }));
      res.json({ success: true, faces });
    } catch (error) {
      console.error('Error getting known faces:', error);
      res.status(500).json({ success: false, error: 'Failed to get known faces' });
    }
  });

  // Delete known face
  app.delete('/api/detection/faces/:personId', requireUser, async (req: Request, res: Response) => {
    try {
      const result = await AppDataSource.query('DELETE FROM visitors WHERE id = $1', [req.params.personId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'Face not found' });
      }
      res.json({ success: true, message: 'Face deleted successfully' });
    } catch (error) {
      console.error('Error deleting known face:', error);
      res.status(500).json({ success: false, error: 'Failed to delete known face' });
    }
  });

  // Retrain face model
  app.post('/api/detection/faces/retrain', requireUser, async (req: Request, res: Response) => {
    try {
      const opencvUrl = process.env.OPENCV_SERVICE_URL || 'http://localhost:8084';
      const response = await fetch(`${opencvUrl}/retrain`, { method: 'POST' });
      const result = await response.json();
      const trainingTime = result.training_time || 0;
      res.json({ success: true, message: 'Face model retrained successfully', trainingTime });
    } catch (error) {
      console.error('Error retraining face model:', error);
      res.status(500).json({ success: false, error: 'Failed to retrain face model' });
    }
  });

  // Register face
  app.post('/api/detection/faces/register', requireUser, async (req: Request, res: Response) => {
    try {
      const { name, imageData } = req.body;
      if (!name || !imageData) {
        return res.status(400).json({ success: false, error: 'Name and imageData are required' });
      }
      const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AppDataSource.query(
        'INSERT INTO visitors (id, name, type, first_seen, last_seen) VALUES ($1, $2, $3, NOW(), NOW())',
        [personId, name, 'known']
      );
      res.json({ success: true, personId, message: `Face registered for ${name}` });
    } catch (error) {
      console.error('Error registering face:', error);
      res.status(500).json({ success: false, error: 'Failed to register face' });
    }
  });

  // Get detection events
  app.get('/api/detection/events', optionalAuth, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per request
      const type = req.query.type as string; // 'person', 'face', 'motion', etc.
      const cameraId = req.query.cameraId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      // Build query conditions
      const conditions: string[] = ['timestamp IS NOT NULL'];
      const values: any[] = [];
      let paramIndex = 1;

      if (type) {
        // Map type to event_type in database
        if (type === 'person' || type === 'motion') {
          conditions.push(`event_type = $${paramIndex++}`);
          values.push('event_motion');
        } else if (type === 'face') {
          conditions.push(`event_type = $${paramIndex++}`);
          values.push('event_face');
        } else {
          // For other types, use direct mapping
          conditions.push(`event_type = $${paramIndex++}`);
          values.push(type);
        }
      } else {
        // If no type specified, get motion and face events (not snapshots)
        conditions.push(`event_type IN ('event_motion', 'event_face')`);
      }

      if (cameraId) {
        conditions.push(`camera_id = $${paramIndex++}`);
        values.push(cameraId);
      }

      if (startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(new Date(startDate));
      }

      if (endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        values.push(new Date(endDate));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as file_uuid,
          COALESCE(df.file_type, e.event_type) as file_type,
          COALESCE(df.camera_id, e.camera_id) as camera_id,
          COALESCE(df.storage_path, e.file_path) as storage_path,
          COALESCE(df.capture_timestamp, e.timestamp) as capture_timestamp,
          COALESCE(df.metadata, e.metadata) as metadata,
          df.original_filename
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        ${whereClause}
        ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC
        LIMIT $${paramIndex}
      `;

      values.push(limit);

      const results = await AppDataSource.query(query, values);

       // Transform results to match expected event format (MotionEvent interface)
      console.log(`Transforming ${results.length} results`);
      const events = results.map((row: any, index: number) => {
        // Debug logging
        console.log(`Processing row ${index}: file_type=${row.file_type}, camera_id=${row.camera_id}`);

        if (!row) {
          console.log('Row is null/undefined');
          return null;
        }

        // Extract confidence from metadata if available, otherwise default to 0
        let confidence = 0;
        if (row.metadata && typeof row.metadata === 'object') {
          // Try to get confidence from various possible locations in metadata
          if (row.metadata.confidence !== undefined) {
            confidence = row.metadata.confidence;
          } else if (row.metadata.persons && row.metadata.persons.length > 0) {
            confidence = row.metadata.persons[0].confidence || 0;
          } else if (row.metadata.faces && row.metadata.faces.length > 0) {
            confidence = row.metadata.faces[0].confidence || 0;
          }
        }

        // Extract detection data from metadata
        let metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};

        // Extract detection counts from metadata
        let persons_detected = metadata.personCount || metadata.persons?.length || 0;
        let faces_detected = metadata.faceCount || metadata.faces?.length || 0;
        let known_faces_count = metadata.knownFaces || 0;
        let unknown_faces_count = metadata.unknownFaces || 0;

        // Extract detection arrays from metadata
        let object_detections = metadata.detections || metadata.persons || [];
        let face_detections = metadata.faces || [];

        // Extract just the filename from the full path for frontend compatibility
        // Use the API endpoint format that serves images from the detection directory
        const filename = row.original_filename || path.basename(row.storage_path);
        let imageUrl = `/api/events/image/${filename}`;

        const eventData = {
          id: filename, // Use filename as ID since we're not joining with events table
          event_type: row.file_type === 'event_face' ? 'face' : 'motion',
          filename: filename,
          timestamp: row.capture_timestamp ? new Date(row.capture_timestamp).toISOString() : new Date().toISOString(),
          cameraId: row.camera_id,
          confidence: confidence,
          metadata: metadata,
          imageUrl: imageUrl, // Add imageUrl field for frontend

          // Detection data extracted from metadata
          persons_detected,
          faces_detected,
          known_faces_count,
          unknown_faces_count,
          object_detections: object_detections || [],
          face_detections: face_detections || [],
        };

        console.log('Returning eventData with keys:', Object.keys(eventData));
        return eventData;
      });

      res.json({
        success: true,
        events: events,
        count: events.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting detection events:', error);
      res.status(500).json({ success: false, error: 'Failed to get detection events' });
    }
  });
  
  // Enhanced motion detection with person/face analysis
  app.post('/api/motion/:cameraId/analyze', requireUser, async (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      const { enablePersonDetection, enableFaceDetection } = req.body;
      
      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      // Get latest motion event frame
      const currentFrame = streamManager.getCurrentFrame(cameraId);
      if (!currentFrame) {
        return res.status(400).json({ success: false, error: 'No frame available from camera' });
      }
      
      const analysisResults = {
        persons: [],
        faces: [],
        timestamp: new Date().toISOString()
      };
      
      // Run person detection if enabled
      if (enablePersonDetection) {
      const objectDetectionService = consolidatedDetectionService;
        const personResult = await objectDetectionService.detectObjects(cameraId, currentFrame);
        analysisResults.persons = personResult.detections.filter((d) => d.class === 'person');
      }

      // Run face detection if enabled
      if (enableFaceDetection) {
        const facialRecognitionService = consolidatedDetectionService;
        const faceResult = await consolidatedDetectionService.detectFaces(cameraId, currentFrame);
        analysisResults.faces = faceResult.faces;
      }
      
      // Emit enhanced motion event
      io.emit('enhancedMotionDetected', {
        cameraId,
        timestamp: new Date().toISOString(),
        hasPersons: analysisResults.persons.length > 0,
        hasFaces: analysisResults.faces.length > 0,
        personCount: analysisResults.persons.length,
        faceCount: analysisResults.faces.length,
        knownFaces: analysisResults.faces.filter((f: any) => f.isKnown).length,
        unknownFaces: analysisResults.faces.filter((f: any) => !f.isKnown).length,
        analysis: analysisResults
      });
      
      res.json({
        success: true,
        analysis: analysisResults
      });
      
    } catch (error) {
      console.error(`Error analyzing motion for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to analyze motion' });
    }
  });
  
  app.get('/api/highlights/:date', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { 
        sort = 'recent',
        limit
      } = req.query;
      
      const limitNum = limit ? parseInt(limit as string) : 0;

      // Treat date as Asia/Kolkata timezone (server TZ)
      const startDate = new Date(`${date}T00:00:00+05:30`);
      const endDate = new Date(`${date}T23:59:59.999+05:30`);

      let orderBy = 'ORDER BY e.timestamp DESC';
      let whereConditions = '';
      
      if (sort === 'persons') {
        orderBy = 'ORDER BY COALESCE(e.persons_detected, 0) DESC, e.timestamp DESC';
      } else if (sort === 'faces') {
        orderBy = 'ORDER BY COALESCE(e.faces_detected, 0) DESC, e.timestamp DESC';
      } else if (sort === 'unknown') {
        whereConditions = 'AND COALESCE(e.unknown_faces_count, 0) > 0';
        orderBy = 'ORDER BY e.timestamp DESC';
      } else if (sort === 'confidence') {
        orderBy = 'ORDER BY e.confidence DESC, e.timestamp DESC';
      }

      let query = `
        SELECT 
          e.id,
          e.file_path as filename,
          e.camera_id,
          e.timestamp,
          e.event_type,
          e.confidence,
          e.persons_detected,
          e.faces_detected,
          e.known_faces_count,
          e.unknown_faces_count,
          e.object_detections,
          e.face_detections,
          e.metadata
        FROM events e
        WHERE e.timestamp BETWEEN $1 AND $2
          AND e.event_type IN ('motion', 'face', 'event_motion', 'event_face')
          ${whereConditions}
        ${orderBy}
      `;

      if (limitNum > 0) {
        query += ` LIMIT ${limitNum}`;
      }

      const results = await AppDataSource.query(query, [startDate, endDate]);

      const highlights = results.map((row: any) => {
        let metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
        const filename = row.filename ? path.basename(row.filename) : null;
        
        return {
          id: row.id,
          filename,
          cameraId: row.camera_id,
          timestamp: row.timestamp,
          eventType: row.event_type,
          confidence: row.confidence,
          personsDetected: row.persons_detected || 0,
          facesDetected: row.faces_detected || 0,
          knownFacesCount: row.known_faces_count || 0,
          unknownFacesCount: row.unknown_faces_count || 0,
          objectDetections: row.object_detections || [],
          faceDetections: row.face_detections || [],
          imageUrl: filename ? `/api/events/image/${filename}` : null,
          metadata
        };
      });

      res.json({
        success: true,
        date,
        sort,
        highlights,
        summary: {
          total: highlights.length,
          totalPersons: highlights.reduce((sum, h) => sum + h.personsDetected, 0),
          totalFaces: highlights.reduce((sum, h) => sum + h.facesDetected, 0),
          knownFaces: highlights.reduce((sum, h) => sum + h.knownFacesCount, 0)
        }
      });
    } catch (error: any) {
      console.error('Error fetching highlights:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.get('/api/highlights/:date/summary', optionalAuth, async (req: Request, res: Response) => {
    try {
      const { date } = req.params;

      const startDate = new Date(`${date}T00:00:00+05:30`);
      const endDate = new Date(`${date}T23:59:59.999+05:30`);

      const hourlyQuery = `
        SELECT 
          EXTRACT(HOUR FROM e.timestamp) as hour,
          COUNT(*) as count
        FROM events e
        WHERE e.timestamp BETWEEN $1 AND $2
          AND e.event_type IN ('motion', 'face', 'event_motion', 'event_face')
        GROUP BY EXTRACT(HOUR FROM e.timestamp)
        ORDER BY hour
      `;

      const categoryQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(e.persons_detected) as total_persons,
          SUM(e.faces_detected) as total_faces,
          SUM(e.known_faces_count) as total_known_faces,
          COUNT(CASE WHEN EXTRACT(HOUR FROM e.timestamp) BETWEEN 22 AND 6 THEN 1 END) as night_events
        FROM events e
        WHERE e.timestamp BETWEEN $1 AND $2
          AND e.event_type IN ('motion', 'face', 'event_motion', 'event_face')
      `;

      const [hourlyData, categoryResult] = await Promise.all([
        AppDataSource.query(hourlyQuery, [startDate, endDate]),
        AppDataSource.query(categoryQuery, [startDate, endDate])
      ]);

      const hourly = Array.from({ length: 24 }, (_, i) => {
        const found = hourlyData.find((h: any) => parseInt(h.hour) === i);
        return { hour: i, count: found ? parseInt(found.count) : 0 };
      });

      res.json({
        success: true,
        date,
        summary: {
          totalEvents: parseInt(categoryResult[0].total),
          totalPersons: parseInt(categoryResult[0].total_persons) || 0,
          totalFaces: parseInt(categoryResult[0].total_faces) || 0,
          knownFaces: parseInt(categoryResult[0].total_known_faces) || 0,
          nightEvents: parseInt(categoryResult[0].night_events) || 0
        },
        hourly
      });
    } catch (error: any) {
      console.error('Error fetching highlights summary:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Configure notification routes
  app.use('/api/notifications', notificationRoutes);

  app.use('/api/detection', detectionRoutes);

  app.use('/api/face-embeddings', faceEmbeddingRoutes);

  app.use('/api/face-config', faceConfigRoutes);

  configureDetectionRedoRoutes(app);

  app.use(rateLimitMiddleware());
}