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

// Define motion event interface
interface MotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  cameraName?: string; // Added for convenience
  labels?: string[]; // Added for convenience
  location?: string; // Added for convenience
}

// Define Alert interface
interface Alert {
  id: string;
  type: 'motion' | 'camera' | 'system';
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  cameraId?: string;
}

// Store recent motion events in memory
const recentEvents: MotionEvent[] = [];

// Store alerts in memory
let alerts: Alert[] = [];

// Define Settings interfaces
interface GeneralSettings {
  systemName: string;
  timezone: string;
  language: string;
  theme: string;
  autoBackup: boolean;
  backupFrequency: string;
}

interface StorageSettings {
  retentionDays: number;
  maxStorageGB: number;
  autoCleanup: boolean;
  compressionEnabled: boolean;
  compressionQuality: number;
}

interface NotificationSettings {
  emailEnabled: boolean;
  emailAddress: string;
  pushEnabled: boolean;
  pushSoundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface SystemSettings {
  general: GeneralSettings;
  storage: StorageSettings;
  notifications: NotificationSettings;
}

// Default settings as fallback
const defaultSystemSettings: SystemSettings = {
  general: {
    systemName: 'Security System',
    timezone: 'UTC',
    language: 'en',
    theme: 'system',
    autoBackup: true,
    backupFrequency: 'daily',
  },
  storage: {
    retentionDays: 30,
    maxStorageGB: 100,
    autoCleanup: true,
    compressionEnabled: true,
    compressionQuality: 80,
  },
  notifications: {
    emailEnabled: false,
    emailAddress: '',
    pushEnabled: true,
    pushSoundEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
};

// Store system settings in memory (cached)
let cachedSystemSettings: SystemSettings | null = null;

// Load settings from database
async function loadSystemSettings(): Promise<SystemSettings> {
  if (cachedSystemSettings) {
    return cachedSystemSettings;
  }

  try {
    if (!AppDataSource.isInitialized) {
      return defaultSystemSettings;
    }

    const result = await AppDataSource.query(`SELECT * FROM system_settings ORDER BY created_at DESC LIMIT 1`);

    if (result && result.length > 0) {
      const db = result[0];
      cachedSystemSettings = {
        general: {
          systemName: db.system_name || 'Security System',
          timezone: db.timezone || 'UTC',
          language: db.language || 'en',
          theme: db.theme || 'system',
          autoBackup: db.auto_backup !== false,
          backupFrequency: db.backup_frequency || 'daily',
        },
        storage: {
          retentionDays: db.retention_days || 30,
          maxStorageGB: parseFloat(db.max_storage_gb) || 100,
          autoCleanup: db.auto_cleanup !== false,
          compressionEnabled: db.compression_enabled !== false,
          compressionQuality: db.compression_quality || 80,
        },
        notifications: {
          emailEnabled: db.email_enabled === true,
          emailAddress: db.email_address || '',
          pushEnabled: db.push_enabled !== false,
          pushSoundEnabled: db.push_sound_enabled !== false,
          quietHoursEnabled: db.quiet_hours_enabled === true,
          quietHoursStart: db.quiet_hours_start || '22:00',
          quietHoursEnd: db.quiet_hours_end || '07:00',
        },
      };
      return cachedSystemSettings;
    }
  } catch (error) {
    console.error('Error loading system settings from database:', error);
  }

  return defaultSystemSettings;
}

// Save settings to database
async function saveSystemSettings(settings: SystemSettings): Promise<boolean> {
  try {
    if (!AppDataSource.isInitialized) {
      return false;
    }

    await AppDataSource.query(
      `UPDATE system_settings SET
        system_name = $1,
        timezone = $2,
        language = $3,
        theme = $4,
        auto_backup = $5,
        backup_frequency = $6,
        retention_days = $7,
        max_storage_gb = $8,
        auto_cleanup = $9,
        compression_enabled = $10,
        compression_quality = $11,
        email_enabled = $12,
        email_address = $13,
        push_enabled = $14,
        push_sound_enabled = $15,
        quiet_hours_enabled = $16,
        quiet_hours_start = $17,
        quiet_hours_end = $18,
        updated_at = NOW()
      WHERE id = (SELECT id FROM system_settings LIMIT 1)`,
      [
        settings.general.systemName,
        settings.general.timezone,
        settings.general.language,
        settings.general.theme,
        settings.general.autoBackup,
        settings.general.backupFrequency,
        settings.storage.retentionDays,
        settings.storage.maxStorageGB,
        settings.storage.autoCleanup,
        settings.storage.compressionEnabled,
        settings.storage.compressionQuality,
        settings.notifications.emailEnabled,
        settings.notifications.emailAddress,
        settings.notifications.pushEnabled,
        settings.notifications.pushSoundEnabled,
        settings.notifications.quietHoursEnabled,
        settings.notifications.quietHoursStart,
        settings.notifications.quietHoursEnd,
      ]
    );

    cachedSystemSettings = settings;
    return true;
  } catch (error) {
    console.error('Error saving system settings to database:', error);
    return false;
  }
}

// Helper to add alerts
const addAlert = (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => {
  const newAlert: Alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    acknowledged: false,
    ...alert,
  };
  alerts.unshift(newAlert); // Add to the beginning
  // Keep only the latest 100 alerts
  if (alerts.length > 100) {
    alerts.pop();
  }
};

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
  return (global as any).streamManager;
}

function getMotionDetector() {
  // Return the optimized motion detector set up in main server file
  return (global as any).motionDetector;
}

function getObjectDetectionService() {
  return (global as any).objectDetectionService;
}

function getFacialRecognitionService() {
  return (global as any).facialRecognitionService;
}

// Routes configuration
export function configureRoutes(app: Express, io: SocketIOServer) {
  
  // Add motion event listener
  const handleMotionDetected = (event: MotionEvent) => {
    // Motion event log disabled - console.log('Motion event received in routes:', event);
    // Add to recent events
    recentEvents.unshift(event);
    
    // Keep only last 100 events
    if (recentEvents.length > 100) {
      recentEvents.pop();
    }

    // Add an alert for motion detection
    addAlert({
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
      res.json({ success: true, alerts: alerts.map(alert => ({
        ...alert,
        timestamp: alert.timestamp.toISOString() // Convert Date to ISO string for API response
      })) });
    } catch (error) {
      console.error('Error getting alerts:', error);
      res.status(500).json({ success: false, error: 'Failed to get alerts' });
    }
  });

  // Acknowledge an alert
  app.post('/api/alerts/:id/acknowledge', requireUser, (req: Request, res: Response) => {
    try {
      const alertId = req.params.id;
      const alertIndex = alerts.findIndex(alert => alert.id === alertId);
      if (alertIndex === -1) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      alerts[alertIndex].acknowledged = true;
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
      const initialLength = alerts.length;
      alerts = alerts.filter(alert => alert.id !== alertId);
      if (alerts.length === initialLength) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
      console.error(`Error deleting alert ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to delete alert' });
    }
  });

  // Get system settings
  app.get('/api/settings', requireUser, async (req: Request, res: Response) => {
    try {
      const settings = await loadSystemSettings();
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error getting system settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get system settings' });
    }
  });

  // Update system settings
  app.put('/api/settings', requireUser, async (req: Request, res: Response) => {
    try {
      const currentSettings = await loadSystemSettings();
      const { general, storage, notifications } = req.body;

      if (general) {
        currentSettings.general = { ...currentSettings.general, ...general };
      }
      if (storage) {
        currentSettings.storage = { ...currentSettings.storage, ...storage };
      }
      if (notifications) {
        currentSettings.notifications = { ...currentSettings.notifications, ...notifications };
      }

      const saved = await saveSystemSettings(currentSettings);
      if (saved) {
        res.json({ success: true, message: 'Settings updated successfully', settings: currentSettings });
      } else {
        res.status(500).json({ success: false, error: 'Failed to save settings to database' });
      }
    } catch (error) {
      console.error('Error updating system settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update system settings' });
    }
  });

  // Debug endpoint to check camera streaming status
  app.get('/api/cameras/debug', (req: Request, res: Response) => {
    try {
      const cameras = getStreamManager().getAllCameras();
      const debugInfo = cameras.map(camera => ({
        id: camera.id,
        name: camera.name,
        isActive: camera.isActive,
        hasProcess: !!camera.process,
        processType: typeof camera.process,
        hasFrame: !!camera.lastFrame,
        frameSize: camera.lastFrame ? camera.lastFrame.length : 0,
        retryCount: camera.retryCount || 0,
        lastError: camera.lastError || null,
        rtspUrl: camera.rtspUrl
      }));
      
      res.json({
        success: true,
        cameras: debugInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get debug info',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Streaming metrics endpoint (new)
  app.get('/api/streaming/metrics', optionalAuth, (req: Request, res: Response) => {
    try {
      const cameras = getStreamManager().getAllCameras();
      const metrics = cameras.map((camera: any) => ({
        cameraId: camera.id,
        cameraName: camera.name,
        viewerCount: camera.activeViewers?.size || 0,
        adaptiveFps: camera.adaptiveFps || 4,
        isActive: camera.isActive,
        bandwidth: camera.streams.get('live')?.lastFrame?.length || 0,
        fps: camera.adaptiveFps || 4,
      }));

      res.json({
        success: true,
        metrics,
        totalViewers: metrics.reduce((sum: number, m: any) => sum + m.viewerCount, 0),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get streaming metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Simple JPEG frame endpoint for camera streams (easier for browser img tags)
  app.get('/snapshot/:cameraId.jpg', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;

      if (!validateCameraIdParam(cameraId, res)) {
        return;
      }

      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      const detectStream = camera.streams.get('detect');
      if (!camera.isActive || !detectStream?.lastFrame) {
        // Return a placeholder image if no frame available
        const placeholder = Buffer.from([
          0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
          0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
        ]);
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': placeholder.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        });
        return res.end(placeholder);
      }
      
      console.log(`*** SNAPSHOT REQUEST for ${cameraId} - frame size: ${detectStream.lastFrame.length} ***`);
      
      // Set proper headers for single JPEG image
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': detectStream.lastFrame.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      
      res.end(detectStream.lastFrame);
    } catch (error) {
      console.error(`Error getting snapshot for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get snapshot' });
    }
  });

  // Test MJPEG stream endpoint for debugging
  app.get('/stream/:cameraId/test', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      const boundary = '--myboundary';
      
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      let frameCount = 0;
      const interval = setInterval(() => {
        if (!res.writable) {
          clearInterval(interval);
          return;
        }
        
        // Generate a simple test frame
        const frameBuffer = Buffer.from(`
          --${boundary}
          Content-Type: image/jpeg
          Content-Length: 1000
          
          // Fake JPEG data for testing
          ${Buffer.alloc(1000, 0).toString('binary')}
        `);
        
        try {
          res.write(frameBuffer);
          frameCount++;
          
          // Stop after 100 frames
          if (frameCount >= 100) {
            clearInterval(interval);
            res.write(`--${boundary}--\r\n`);
            res.end();
          }
        } catch (e) {
          clearInterval(interval);
        }
      }, 100); // 10 FPS
      
    } catch (error) {
      console.error('Test stream error:', error);
      res.status(500).json({ success: false, error: 'Test stream failed' });
    }
  });

  // Get list of all cameras
  app.get('/api/cameras', (req: Request, res: Response) => {
    try {
      logger.apiRequest('GET', '/api/cameras', req.ip || 'unknown', req.get('User-Agent'));
      
      // Get stream manager dynamically from global scope
      const currentStreamManager = getStreamManager();
      
      if (!currentStreamManager) {
        logger.error('streamManager is not initialized', 'API');
        // Return empty camera list instead of error to allow frontend to work
        return res.json({ 
          success: true, 
          cameras: [],
          timestamp: new Date().toISOString(),
          message: 'Camera system not initialized - no cameras configured'
        });
      }

      const cameras = currentStreamManager.getAllCameras();
      logger.info('Fetched cameras from stream manager', 'API', { cameraCount: cameras.length });
      
      // Optimize camera data - only include essential fields for frontend
      const optimizedCameras = cameras.map((camera: Camera) => {
        let status = 'offline';
        if (camera.isActive) {
          status = 'online';
        } else if (camera.retryCount && camera.retryCount > 0) {
          status = 'warning'; // Camera is trying to reconnect
        }
        
        // Return only essential fields to reduce response size
        const detectStream = camera.streams.get('detect');
        const recordStream = camera.streams.get('record');
        return {
          id: camera.id,
          name: camera.name,
          isActive: camera.isActive,
          nightMode: camera.nightMode,
          status,
          lastError: camera.lastError || undefined,
          retryCount: camera.retryCount || 0,
          config: {
            detect: camera.config.detect,
            streams: camera.config.streams,
            objects: camera.config.objects,
            zones: camera.config.zones
          },
          streams: {
            detect: detectStream ? {
              isActive: detectStream.isActive,
              fps: detectStream.fps,
              width: detectStream.width,
              height: detectStream.height
            } : null,
            record: recordStream ? {
              isActive: recordStream.isActive,
              fps: recordStream.fps,
              width: recordStream.width,
              height: recordStream.height
            } : null
          }
        };
      });

      logger.apiResponse('GET', '/api/cameras', 200);

      res.json({ 
        success: true, 
        cameras: optimizedCameras,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.apiError('GET', '/api/cameras', error as Error, 500);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get cameras',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get details for a specific camera
  app.get('/api/cameras/:id', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      res.json({ success: true, camera });
    } catch (error) {
      console.error(`Error getting camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get camera' });
    }
  });

  // Add a new camera
  app.post('/api/cameras', validate(commonSchemas.createCamera), (req: Request, res: Response) => {
    try {
      const { name, rtspUrl, username, password, frameRate, resolution, nightMode } = req.body;
      
      const cameraId = streamManager.addCamera({
        id: '', // Will be auto-generated by config
        name,
        enabled: true,
        streams: [
          {
            path: rtspUrl,
            roles: ['detect', 'record', 'live'],
            width: parseInt(resolution?.split('x')[0]) || 1920,
            height: parseInt(resolution?.split('x')[1]) || 1080,
            fps: frameRate || 5
          }
        ],
        detect: {
          width: 640,
          height: 360,
          fps: 5
        },
        record: {
          enabled: true
        },
        nightMode: nightMode || false
      });
      
      res.json({ success: true, cameraId });
    } catch (error) {
      console.error('Error adding camera:', error);
      res.status(500).json({ success: false, error: 'Failed to add camera' });
    }
  });

  // Update camera settings
  app.put('/api/cameras/:id', (req: Request, res: Response) => {
    try {
      if (!streamManager) {
        return res.status(503).json({ 
          success: false, 
          error: 'Camera system not initialized',
          status: 'unavailable'
        });
      }

      const { name, nightMode } = req.body;
      
      // Validate and convert camera config updates
      const updates: Partial<CameraConfig> = {};
      if (name !== undefined) updates.name = name;
      if (nightMode !== undefined) updates.nightMode = nightMode;

      // Verify camera exists before update
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        return res.status(404).json({ 
          success: false, 
          error: 'Camera not found',
          cameraId: req.params.id
        });
      }

      const updated = streamManager.updateCamera(req.params.id, updates);
      if (!updated) {
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update camera',
          cameraId: req.params.id
        });
      }
      
      // Get updated camera state
      const updatedCamera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      res.json({ 
        success: true,
        camera: {
          ...updatedCamera,
          status: updatedCamera?.isActive ? 'online' : 'offline'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error updating camera ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update camera',
        details: error instanceof Error ? error.message : 'Unknown error',
        cameraId: req.params.id
      });
    }
  });

  // Delete a camera
  app.delete('/api/cameras/:id', (req: Request, res: Response) => {
    try {
      const removed = streamManager.removeCamera(req.params.id);
      if (!removed) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`Error removing camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to remove camera' });
    }
  });

  // Start test streaming for a camera
  app.post('/api/cameras/:id/stream/start-test', (req: Request, res: Response) => {
    try {
      if (!streamManager) {
        return res.status(503).json({ 
          success: false, 
          error: 'Camera system not initialized',
          status: 'unavailable'
        });
      }

      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        return res.status(404).json({ 
          success: false, 
          error: 'Camera not found',
          cameraId: req.params.id
        });
      }

      // Stop any existing stream
      streamManager.stopStream(req.params.id);

      // Start test stream for detect role
      streamManager.startTestStream(req.params.id, 'detect');

      // Mark camera as active for test streaming
      camera.isActive = true;

      res.json({ 
        success: true, 
        status: 'test-streaming',
        cameraId: req.params.id,
        message: 'Test stream started. Access via /stream/' + req.params.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error starting test stream for camera ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start test stream',
        details: error instanceof Error ? error.message : 'Unknown error',
        cameraId: req.params.id
      });
    }
  });

  // Start streaming from a camera
  app.post('/api/cameras/:id/stream/start', (req: Request, res: Response) => {
    try {
      if (!streamManager) {
        return res.status(503).json({ 
          success: false, 
          error: 'Camera system not initialized',
          status: 'unavailable'
        });
      }

      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        return res.status(404).json({ 
          success: false, 
          error: 'Camera not found',
          cameraId: req.params.id
        });
      }

      if (camera.isActive) {
        return res.status(400).json({ 
          success: false, 
          error: 'Camera is already streaming',
          status: 'streaming',
          cameraId: req.params.id
        });
      }

      // Start real RTSP streams for all roles
      camera.streams.forEach((_value: any, role: 'detect' | 'record' | 'live') => {
        streamManager.startStream(req.params.id, role);
      });

      res.json({ 
        success: true, 
        status: 'streaming',
        cameraId: req.params.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error starting stream for camera ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start stream',
        details: error instanceof Error ? error.message : 'Unknown error',
        cameraId: req.params.id
      });
    }
  });

  // Stop streaming from a camera
  app.post('/api/cameras/:id/stream/stop', (req: Request, res: Response) => {
    try {
      const stopped = streamManager.stopStream(req.params.id);
      if (!stopped) {
        return res.status(500).json({ success: false, error: 'Failed to stop stream' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`Error stopping stream for camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to stop stream' });
    }
  });

  // Take a snapshot from a camera
  app.post('/api/cameras/:id/snapshot', async (req: Request, res: Response) => {
    try {
      const { resolution } = req.body || {};
      const snapshotPath = await streamManager.takeSnapshot(req.params.id, resolution);
      if (!snapshotPath) {
        return res.status(500).json({ success: false, error: 'Failed to take snapshot' });
      }
      res.json({ success: true, snapshotPath });
    } catch (error) {
      console.error(`Error taking snapshot for camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to take snapshot' });
    }
  });

  // Toggle night mode for a camera
  app.post('/api/cameras/:id/night-mode', (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: 'Enabled parameter must be a boolean' });
      }
      
      const updated = streamManager.toggleNightMode(req.params.id, enabled);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(`Error toggling night mode for camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to toggle night mode' });
    }
  });

  // Streaming endpoints for camera video feeds
  // MJPEG stream endpoint for live camera feeds
  app.get('/stream/:cameraId', (req: Request, res: Response) => {
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
        return res.status(503).json({ success: false, error: 'Camera is not streaming' });
      }
      
      console.log(`*** HTTP STREAM REQUEST for camera ${cameraId} ***`);
      
      // Set proper headers for MJPEG streaming
      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Check if this is a test stream or real RTSP stream
      const stream = streamManager.getStream(cameraId, 'detect');
      const process = stream ? stream.process : null;
      const isTestStream = stream && !process;
      
      if (process && process.stdout && !isTestStream) {
        console.log(`*** FOUND REAL CAMERA PROCESS for ${cameraId} - STARTING MJPEG STREAM ***`);
        
        let isActive = true;
        
        // Function to write MJPEG chunk in proper format
        const writeChunk = (chunk: Buffer) => {
          if (!isActive) return;
          
          const chunkHeader = `Content-Type: image/jpeg\r\nContent-Length: ${chunk.length}\r\n\r\n`;
          const chunkEnd = `\r\n--${boundary}\r\n`;
          
          try {
            res.write(`--${boundary}\r\n`);
            res.write(chunkHeader);
            res.write(chunk);
            res.write(chunkEnd);
          } catch (err) {
            console.error(`Error writing chunk for ${cameraId}:`, err);
            isActive = false;
          }
        };

        // Handle FFmpeg output
        process.stdout.on('data', (chunk) => {
          writeChunk(chunk);
        });
        
        process.stdout.on('error', (err) => {
          console.error(`Stream error for camera ${cameraId}:`, err);
          console.log(`*** PROCESS ENDED WITH ERROR for ${cameraId} ***`);
          if (isActive && !res.headersSent) {
            isActive = false;
            try {
              res.write(`--${boundary}--\r\n`);
              res.end();
            } catch (e) {}
          }
        });
        
        process.stdout.on('close', () => {
          console.log(`*** PROCESS CLOSED for ${cameraId} ***`);
          if (isActive && !res.headersSent) {
            isActive = false;
            try {
              res.write(`--${boundary}--\r\n`);
              res.end();
            } catch (e) {}
          }
        });
        
        process.on('exit', (code) => {
          console.log(`*** PROCESS EXITED for ${cameraId} with code: ${code} ***`);
          if (isActive && !res.headersSent) {
            isActive = false;
            try {
              res.write(`--${boundary}--\r\n`);
              res.end();
            } catch (e) {}
          }
        });
        
        req.on('close', () => {
          console.log(`*** HTTP REQUEST CLOSED for ${cameraId} ***`);
          isActive = false;
          if (process) {
            process.kill('SIGTERM');
          }
        });
        
        req.on('aborted', () => {
          console.log(`*** HTTP REQUEST ABORTED for ${cameraId} ***`);
          isActive = false;
          if (process) {
            process.kill('SIGTERM');
          }
        });

        // Send initial boundary to start the stream
        try {
          res.write(`--${boundary}\r\n`);
          console.log(`*** MJPEG STREAM STARTED for ${cameraId} ***`);
        } catch (err) {
          console.error(`Error starting stream for ${cameraId}:`, err);
        }
        
      } else {
        console.log(`*** NO REAL PROCESS FOUND for ${cameraId} - USING TEST STREAM ***`);
        // Test stream - generate MJPEG frames on the fly
        const generateTestMjpegFrame = async (cameraId: string) => {
          try {
            const { generateTestJpegFrame } = await import('../utils/testImageGenerator.js');
            return generateTestJpegFrame(cameraId);
          } catch (err) {
            console.error(`Error importing test frame generator:`, err);
            // Return a simple buffer
            return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAErCXcZAAAADklEQVR4AewAfQXgcAAAvBE4dLToAAAAAAAD8/UEAAQAAAgwECkAAMAAsCAAALBhAAAAAAAABJRU5ErkJggg==', 'base64');
          }
        };
        
        let interval: NodeJS.Timeout | null = null;
        
        let isActive = true;
        
        const sendFrame = async () => {
          if (!isActive) return;
          
          try {
            const frame = await generateTestMjpegFrame(cameraId);
            const chunkHeader = `Content-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
            const chunkEnd = `\r\n--${boundary}\r\n`;
            
            try {
              res.write(`--${boundary}\r\n`);
              res.write(chunkHeader);
              res.write(frame);
              res.write(chunkEnd);
            } catch (err) {
              console.error(`Error writing test frame for ${cameraId}:`, err);
              isActive = false;
            }
          } catch (err) {
            console.error(`Error generating test frame for ${cameraId}:`, err);
            isActive = false;
          }
        };
        
        // Send frames at detect stream frame rate (default 5 fps)
        const detectStream = camera.streams.get('detect');
        const fps = detectStream?.fps || 5;
        interval = setInterval(sendFrame, Math.floor(1000 / fps));
        
        // Start with first frame and initial boundary
        try {
          res.write(`--${boundary}\r\n`);
          sendFrame();
          console.log(`*** TEST STREAM STARTED for ${cameraId} ***`);
        } catch (err) {
          console.error(`Error starting test stream for ${cameraId}:`, err);
        }
        
        req.on('close', () => {
          console.log(`*** TEST STREAM REQUEST CLOSED for ${cameraId} ***`);
          isActive = false;
          if (interval) {
            clearInterval(interval);
            try {
              res.write(`--${boundary}--\r\n`);
              res.end();
            } catch (e) {}
          }
        });
        
        req.on('aborted', () => {
          console.log(`*** TEST STREAM REQUEST ABORTED for ${cameraId} ***`);
          isActive = false;
          if (interval) {
            clearInterval(interval);
            try {
              res.write(`--${boundary}--\r\n`);
              res.end();
            } catch (e) {}
          }
        });
      }
      
    } catch (error) {
      console.error(`Error serving stream for camera ${req.params.cameraId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to serve stream' });
      }
    }
  });

  // Low-resolution detect stream for OpenCV detection service
  app.get('/api/streams/:cameraId/detect', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;

      if (!validateCameraIdParam(cameraId, res)) {
        return;
      }

      const camera = streamManager.getCamera(cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      const stream = camera.streams.get('detect');
      if (!stream) {
        return res.status(404).json({ success: false, error: 'Detect stream not configured' });
      }

      // Ensure detect stream is started
      if (!stream.isActive) {
        streamManager.startStream(cameraId, 'detect');
      }

      console.log(`*** DETECT STREAM REQUEST for camera ${cameraId} ***`);

      // Set proper headers for MJPEG streaming
      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Forward frames from detect stream
      let isActive = true;

      const sendFrame = () => {
        if (!isActive || !stream.lastFrame) return;

        const frame = stream.lastFrame;
        const chunkHeader = `Content-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
        const chunkEnd = `\r\n--${boundary}\r\n`;

        try {
          res.write(`--${boundary}\r\n`);
          res.write(chunkHeader);
          res.write(frame);
          res.write(chunkEnd);
        } catch (err) {
          isActive = false;
        }
      };

      // Send frames at detect stream FPS
      const interval = setInterval(sendFrame, Math.floor(1000 / stream.fps));

      // Start with initial boundary
      res.write(`--${boundary}\r\n`);

      req.on('close', () => {
        isActive = false;
        clearInterval(interval);
        try {
          res.write(`--${boundary}--\r\n`);
          res.end();
        } catch (e) {}
      });

      req.on('aborted', () => {
        isActive = false;
        clearInterval(interval);
      });

    } catch (error) {
      console.error(`Error serving detect stream for camera ${req.params.cameraId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to serve detect stream' });
      }
    }
  });

  // High-resolution live stream for browser viewing
  app.get('/api/streams/:cameraId/live', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;

      if (!validateCameraIdParam(cameraId, res)) {
        return;
      }

      const camera = streamManager.getCamera(cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      // Try record stream first (higher quality), fallback to detect
      let stream = camera.streams.get('record');
      if (!stream) {
        stream = camera.streams.get('detect');
      }
      if (!stream) {
        return res.status(404).json({ success: false, error: 'No suitable stream found' });
      }

      // Ensure stream is started
      if (!stream.isActive) {
        const role = stream.role;
        streamManager.startStream(cameraId, role);
      }

      console.log(`*** LIVE STREAM REQUEST for camera ${cameraId} ***`);

      // Set proper headers for MJPEG streaming
      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Forward frames from stream
      let isActive = true;

      const sendFrame = () => {
        if (!isActive || !stream?.lastFrame) return;

        const frame = stream.lastFrame;
        const chunkHeader = `Content-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
        const chunkEnd = `\r\n--${boundary}\r\n`;

        try {
          res.write(`--${boundary}\r\n`);
          res.write(chunkHeader);
          res.write(frame);
          res.write(chunkEnd);
        } catch (err) {
          isActive = false;
        }
      };

      // Send frames at stream FPS (up to 15 for live viewing)
      const fps = Math.min(stream.fps, 15);
      const interval = setInterval(sendFrame, Math.floor(1000 / fps));

      // Start with initial boundary
      res.write(`--${boundary}\r\n`);

      req.on('close', () => {
        isActive = false;
        clearInterval(interval);
        try {
          res.write(`--${boundary}--\r\n`);
          res.end();
        } catch (e) {}
      });

      req.on('aborted', () => {
        isActive = false;
        clearInterval(interval);
      });

    } catch (error) {
      console.error(`Error serving live stream for camera ${req.params.cameraId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to serve live stream' });
      }
    }
  });

  // Single frame endpoint for OpenCV detection (non-streaming)
  app.get('/api/streams/:cameraId/frame', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;

      if (!validateCameraIdParam(cameraId, res)) {
        return;
      }

      const camera = streamManager.getCamera(cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      const stream = camera.streams.get('detect');
      if (!stream || !stream.lastFrame) {
        return res.status(503).json({ success: false, error: 'No frame available' });
      }

      // Set headers for single JPEG
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': stream.lastFrame.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });

      res.end(stream.lastFrame);

    } catch (error) {
      console.error(`Error getting frame for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get frame' });
    }
  });

  // Get stream status for a camera
  app.get('/api/streams/:cameraId/status', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;

      if (!validateCameraIdParam(cameraId, res)) {
        return;
      }

      const camera = streamManager.getCamera(cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      const streams: Record<string, any> = {};
      camera.streams.forEach((stream, role) => {
        streams[role] = {
          isActive: stream.isActive,
          fps: stream.fps,
          width: stream.width,
          height: stream.height,
          hasFrame: !!stream.lastFrame,
          frameSize: stream.lastFrame?.length || 0
        };
      });

      res.json({
        success: true,
        cameraId,
        cameraName: camera.name,
        isActive: camera.isActive,
        streams,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Error getting stream status for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get stream status' });
    }
  });

  // Zone configuration endpoints

  // Get zones for a camera
  app.get('/api/cameras/:cameraId/zones', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      res.json({
        success: true,
        cameraId: req.params.cameraId,
        zones: camera.config.zones || []
      });
    } catch (error) {
      console.error(`Error getting zones for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get zones' });
    }
  });

  // Add a zone to a camera
  app.post('/api/cameras/:cameraId/zones', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      const { id, name, coordinates, objects, inertia, loiteringTime } = req.body;

      if (!id || !name || !coordinates || !Array.isArray(coordinates)) {
        return res.status(400).json({
          success: false,
          error: 'Zone must have id, name, and coordinates (array of [x,y] normalized 0-1)'
        });
      }

      // Validate coordinates format
      const validCoords = coordinates.every((coord: any) =>
        Array.isArray(coord) && coord.length === 2 &&
        coord[0] >= 0 && coord[0] <= 1 &&
        coord[1] >= 0 && coord[1] <= 1
      );

      if (!validCoords) {
        return res.status(400).json({
          success: false,
          error: 'Coordinates must be arrays of [x,y] with values between 0 and 1'
        });
      }

      const newZone = {
        id,
        name,
        coordinates,
        objects: objects || ['person'],
        inertia: inertia || 3,
        loiteringTime: loiteringTime || 0
      };

      if (!camera.config.zones) {
        camera.config.zones = [];
      }

      // Check for duplicate zone id
      const existingIndex = camera.config.zones.findIndex((z: any) => z.id === id);
      if (existingIndex >= 0) {
        camera.config.zones[existingIndex] = newZone;
      } else {
        camera.config.zones.push(newZone);
      }

      res.json({
        success: true,
        message: existingIndex >= 0 ? 'Zone updated' : 'Zone added',
        zone: newZone
      });
    } catch (error) {
      console.error(`Error adding zone for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to add zone' });
    }
  });

  // Update a zone
  app.put('/api/cameras/:cameraId/zones/:zoneId', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      if (!camera.config.zones) {
        return res.status(404).json({ success: false, error: 'No zones configured' });
      }

      const zoneIndex = camera.config.zones.findIndex((z: any) => z.id === req.params.zoneId);
      if (zoneIndex < 0) {
        return res.status(404).json({ success: false, error: 'Zone not found' });
      }

      const { name, coordinates, objects, inertia, loiteringTime } = req.body;

      if (name) camera.config.zones[zoneIndex].name = name;
      if (coordinates) camera.config.zones[zoneIndex].coordinates = coordinates;
      if (objects) camera.config.zones[zoneIndex].objects = objects;
      if (inertia !== undefined) camera.config.zones[zoneIndex].inertia = inertia;
      if (loiteringTime !== undefined) camera.config.zones[zoneIndex].loiteringTime = loiteringTime;

      res.json({
        success: true,
        message: 'Zone updated',
        zone: camera.config.zones[zoneIndex]
      });
    } catch (error) {
      console.error(`Error updating zone for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update zone' });
    }
  });

  // Delete a zone
  app.delete('/api/cameras/:cameraId/zones/:zoneId', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      if (!camera.config.zones) {
        return res.status(404).json({ success: false, error: 'No zones configured' });
      }

      const zoneIndex = camera.config.zones.findIndex((z: any) => z.id === req.params.zoneId);
      if (zoneIndex < 0) {
        return res.status(404).json({ success: false, error: 'Zone not found' });
      }

      camera.config.zones.splice(zoneIndex, 1);

      res.json({
        success: true,
        message: 'Zone deleted'
      });
    } catch (error) {
      console.error(`Error deleting zone for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to delete zone' });
    }
  });

  // Object filters endpoints

  // Get object filters for a camera
  app.get('/api/cameras/:cameraId/filters', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      res.json({
        success: true,
        cameraId: req.params.cameraId,
        track: camera.config.objects?.track || [],
        filters: camera.config.objects?.filters || {}
      });
    } catch (error) {
      console.error(`Error getting filters for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get filters' });
    }
  });

  // Update object track list
  app.put('/api/cameras/:cameraId/filters/track', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      const { track } = req.body;
      if (!Array.isArray(track)) {
        return res.status(400).json({ success: false, error: 'Track must be an array of object labels' });
      }

      if (!camera.config.objects) {
        camera.config.objects = { track: [], filters: {} };
      }
      camera.config.objects.track = track;

      res.json({
        success: true,
        message: 'Track list updated',
        track
      });
    } catch (error) {
      console.error(`Error updating track list for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update track list' });
    }
  });

  // Update object filter for a specific label
  app.put('/api/cameras/:cameraId/filters/:label', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      const { minArea, maxArea, minRatio, maxRatio, minScore, threshold, mask } = req.body;

      if (!camera.config.objects) {
        camera.config.objects = { track: [], filters: {} };
      }
      if (!camera.config.objects.filters) {
        camera.config.objects.filters = {};
      }

      camera.config.objects.filters[req.params.label] = {
        minArea: minArea || 0,
        maxArea: maxArea || 24000000,
        minRatio: minRatio || 0,
        maxRatio: maxRatio || 24000000,
        minScore: minScore || 0.5,
        threshold: threshold || 0.7,
        mask: mask || ''
      };

      res.json({
        success: true,
        message: `Filter for ${req.params.label} updated`,
        filter: camera.config.objects.filters[req.params.label]
      });
    } catch (error) {
      console.error(`Error updating filter for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update filter' });
    }
  });

  // Delete object filter
  app.delete('/api/cameras/:cameraId/filters/:label', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      if (camera.config.objects?.filters?.[req.params.label]) {
        delete camera.config.objects.filters[req.params.label];
      }

      res.json({
        success: true,
        message: `Filter for ${req.params.label} deleted`
      });
    } catch (error) {
      console.error(`Error deleting filter for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to delete filter' });
    }
  });

  // Simplified motion detection endpoints
  
  // Get motion detection settings for a camera
  app.get('/api/motion/:cameraId/settings', (req: Request, res: Response) => {
    try {
      const motionDetector = getMotionDetector();
      const settings = motionDetector.getSettings(req.params.cameraId);
      if (!settings) {
        return res.status(404).json({ success: false, error: 'Settings not found' });
      }
      res.json({ success: true, settings });
    } catch (error) {
      console.error(`Error getting motion settings for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get motion settings' });
    }
  });

  // Update motion detection settings for a camera
  app.put('/api/motion/:cameraId/settings', (req: Request, res: Response) => {
    try {
      const { enabled, sensitivity, cooldownPeriod } = req.body;
      const motionDetector = getMotionDetector();
      const updated = motionDetector.updateSettings(req.params.cameraId, {
        enabled,
        sensitivity,
        cooldownPeriod
      });

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error(`Error updating motion settings for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update motion settings' });
    }
  });

  // Get historical motion events with pagination and filtering (database-based implementation)
  app.get('/api/events/history', async (req: Request, res: Response) => {
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

  // Get motion events for a specific camera (still using recentEvents for real-time updates)
  app.get('/api/motion/:cameraId/events', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const events = recentEvents
        .filter(event => event.cameraId === req.params.cameraId)
        .slice(0, limit);
      res.json({ success: true, events });
    } catch (error) {
      console.error(`Error getting motion events for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get motion events' });
    }
  });

  // Search events (database-based implementation)
  app.get('/api/events/search', async (req: Request, res: Response) => {
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
        sortOrder: (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
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

  app.get('/api/events/search/legacy', async (req: Request, res: Response) => {
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
  app.get('/api/motion/events', async (req: Request, res: Response) => {
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
  app.get('/api/motion/:cameraId/events', async (req: Request, res: Response) => {
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
  app.post('/api/events/:id/archive', (req: Request, res: Response) => {
    try {
      const eventId = req.params.id;
      // In a real application, you would move the event data to an archive storage
      // For this in-memory example, we'll just remove it from recentEvents
      const initialLength = recentEvents.length;
      const eventIndex = recentEvents.findIndex(event => event.id === eventId);
      if (eventIndex > -1) {
        recentEvents.splice(eventIndex, 1);
      }

      if (recentEvents.length === initialLength) {
        return res.status(404).json({ success: false, error: 'Event not found or already archived' });
      }
      res.json({ success: true, message: 'Event archived successfully' });
    } catch (error) {
      console.error(`Error archiving event ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to archive event' });
    }
  });

  // Trigger a simulated motion event (for testing)
  app.post('/api/motion/:cameraId/simulate', (req: Request, res: Response) => {
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

  // List event images
  app.get('/api/events/list', async (req: Request, res: Response) => {
    try {
      // Query event files from database
      const query = `
        SELECT
          COALESCE(df.storage_path, e.file_path) as file_path,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE COALESCE(df.file_type, e.event_type) IN ('event_motion', 'event_face')
        ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC
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
  app.get('/api/events/list-enhanced', async (req: Request, res: Response) => {
    try {
      const {
        limit,
        page = 1,
        pageSize = 20,
        event_type,
        camera_id,
        start_date,
        end_date,
        searchQuery,
        sortBy = 'newest'
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
        conditions.push(`e.timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        queryParams.push(new Date(start_date as string), new Date(end_date as string));
        paramIndex += 2;
      } else if (start_date) {
        // Single date: start of that day to end of that day
        const startDate = new Date(start_date as string);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(start_date as string);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(`e.timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        queryParams.push(startDate, endDate);
        paramIndex += 2;
      } else if (end_date) {
        // End date only
        const endDate = new Date(end_date as string);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(`e.timestamp <= $${paramIndex}`);
        queryParams.push(endDate);
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
          id: filename, // Use filename as ID since we're not joining with events table
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
  app.get('/api/events/:id/details', async (req: Request, res: Response) => {
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
  app.get('/api/events/image/:filename', async (req: Request, res: Response) => {
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

  // TEST ENDPOINT: Add mock detection data to events
  app.post('/api/test/add-detection-data', async (req: Request, res: Response) => {
    try {
      const { filename } = req.body;

      if (!filename) {
        return res.status(400).json({ success: false, error: 'Filename is required' });
      }

      // Check if file exists
      const query = `
        SELECT
          COALESCE(df.storage_path, e.file_path) as storage_path,
          COALESCE(df.camera_id, e.camera_id) as camera_id,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE e.file_path LIKE $1
          AND COALESCE(df.file_type, e.event_type) IN ('event_motion', 'event_face')
        LIMIT 1
      `;

      const results = await AppDataSource.query(query, [filename]);

      if (results.length === 0) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const event = results[0];

      // Create mock detection data
      const mockDetections = {
        persons_detected: Math.floor(Math.random() * 3) + 1, // 1-3 persons
        faces_detected: Math.floor(Math.random() * 2), // 0-1 faces
        known_faces_count: Math.floor(Math.random() * 2),
        unknown_faces_count: 0,
        object_detections: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => ({
          class: 'person',
          confidence: 0.85 + Math.random() * 0.14,
          bbox: {
            x: Math.floor(Math.random() * 400),
            y: Math.floor(Math.random() * 300),
            width: Math.floor(Math.random() * 100) + 50,
            height: Math.floor(Math.random() * 200) + 100
          }
        })),
        face_detections: Math.random() > 0.5 ? [{
          id: 'test-face-' + Date.now(),
          name: 'Test Person',
          isKnown: true,
          confidence: 0.90 + Math.random() * 0.09,
          bbox: {
            x: Math.floor(Math.random() * 400),
            y: Math.floor(Math.random() * 300),
            width: 80,
            height: 100
          }
        }] : []
      };

      // Update events table
      const updateEventQuery = `
        UPDATE events
        SET 
          persons_detected = $1,
          faces_detected = $2,
          known_faces_count = $3,
          unknown_faces_count = $4,
          object_detections = $5,
          face_detections = $6,
          confidence = $7
        WHERE file_path = $8
        RETURNING id
      `;

      const updatedEvents = await AppDataSource.query(updateEventQuery, [
        mockDetections.persons_detected,
        mockDetections.faces_detected,
        mockDetections.known_faces_count,
        mockDetections.unknown_faces_count,
        JSON.stringify(mockDetections.object_detections),
        JSON.stringify(mockDetections.face_detections),
        0.85,
        event.storage_path
      ]);

      // Update events metadata as well
      const updateEventsQuery = `
        UPDATE events
        SET metadata = jsonb_set(
          COALESCE(metadata::jsonb, '{}'::jsonb),
          '{detectionAddedAt}',
          to_jsonb(NOW())
        )::text
        WHERE file_path LIKE $1
      `;

      await AppDataSource.query(updateEventsQuery, [`%${filename}`]);

      console.log(`[TestData] Added detection data to ${filename}:`, mockDetections);

      res.json({
        success: true,
        message: 'Detection data added successfully',
        eventId: updatedEvents[0]?.id,
        detectionData: mockDetections
      });
    } catch (error) {
      console.error('Error adding test detection data:', error);
      res.status(500).json({ success: false, error: 'Failed to add detection data' });
    }
  });

  // List snapshots
  app.get('/api/snapshots/list', async (req: Request, res: Response) => {
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

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    try {
      const cameras = getStreamManager().getAllCameras();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeCameras: cameras.filter((c: any) => c.isActive).length
      });
    } catch (error) {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeCameras: 0
      });
    }
  });

  // System overview endpoint
  app.get('/api/system/overview', (req: Request, res: Response) => {
    try {
      const cameras = getStreamManager().getAllCameras();
      const overview = {
        status: 'healthy',
        uptime: process.uptime(),
        totalCameras: cameras.length,
        onlineCameras: cameras.filter((c: Camera) => c.isActive).length,
        totalEvents: recentEvents.length,
        todayEvents: recentEvents.filter((e: MotionEvent) => {
          const eventDate = new Date(e.timestamp);
          const today = new Date();
          return eventDate.getDate() === today.getDate() &&
                     eventDate.getMonth() === today.getMonth() &&
                     eventDate.getFullYear() === today.getFullYear();
        }).length,
        storageUsed: 0, // TODO: Calculate actual storage usage
        storageTotal: 1000000000 // 1GB default
      };
      
      res.json({ success: true, data: overview });
    } catch (error) {
      console.error('Error getting system overview:', error);
      res.status(500).json({ success: false, error: 'Failed to get system overview' });
    }
  });

  // System storage endpoint
  app.get('/api/system/storage', (req: Request, res: Response) => {
    console.log('Storage endpoint called');
    try {
      console.log('Config object:', JSON.stringify(config, null, 2));
      console.log('Config.storage:', config.storage);
      // Calculate storage usage for events and snapshots
      const eventsDir = config.storage?.eventsDir;
      const snapshotsDir = config.storage?.snapshotsDir;
      console.log('Events dir:', eventsDir);
      console.log('Snapshots dir:', snapshotsDir);

      if (!eventsDir || !snapshotsDir) {
        throw new Error('Storage directories not configured properly');
      }
      
      let eventsSize = 0;
      let snapshotsSize = 0;
      
      try {
        if (fs.existsSync(eventsDir)) {
          const eventFiles = fs.readdirSync(eventsDir);
          eventsSize = eventFiles.reduce((total: number, file: string) => {
            const filePath = path.join(eventsDir, file);
            const stats = fs.statSync(filePath);
            return total + stats.size;
          }, 0);
        }
        
        if (fs.existsSync(snapshotsDir)) {
          const snapshotFiles = fs.readdirSync(snapshotsDir);
          snapshotsSize = snapshotFiles.reduce((total: number, file: string) => {
            const filePath = path.join(snapshotsDir, file);
            const stats = fs.statSync(filePath);
            return total + stats.size;
          }, 0);
        }
      } catch (err) {
        console.warn('Error calculating storage:', err);
      }
      
      const totalUsed = (eventsSize + snapshotsSize) / (1024 * 1024 * 1024); // Convert to GB
      const totalAvailable = 500; // Default 500GB - could be made configurable
      
      res.json({
        success: true,
        storage: {
          used: Math.round(totalUsed * 100) / 100, // Round to 2 decimal places
          total: totalAvailable,
          eventsSize: Math.round((eventsSize / (1024 * 1024)) * 100) / 100, // MB
          snapshotsSize: Math.round((snapshotsSize / (1024 * 1024)) * 100) / 100, // MB
          percentage: Math.round((totalUsed / totalAvailable) * 10000) / 100 // Percentage with 2 decimals
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      console.error('Error getting storage info:', error);
      console.error('Error details:', errorMessage);
      console.error('Stack trace:', errorStack);
      res.status(500).json({
        success: false,
        error: 'Failed to get storage info',
        details: errorMessage,
        stack: errorStack
      });
    }
  });

  // System health endpoint
  app.get('/api/system/health', (req: Request, res: Response) => {
    try {
      const cameras = getStreamManager().getAllCameras();
      const onlineCameras = cameras.filter((c: any) => c.isActive);
      const offlineCameras = cameras.filter((c: any) => !c.isActive);
      
      // Determine overall health status
      let status = 'healthy';
      const issues = [];
      
      if (offlineCameras.length > 0) {
        status = 'warning';
        issues.push(`${offlineCameras.length} camera(s) offline`);
      }
      
      if (onlineCameras.length === 0 && cameras.length > 0) {
        status = 'critical';
        issues.push('All cameras offline');
      }
      
      // Check system uptime (if less than 5 minutes, might be unstable)
      const uptime = process.uptime();
      if (uptime < 300) { // 5 minutes
        issues.push('System recently restarted');
      }
      
      res.json({
        success: true,
        health: {
          status,
          uptime,
          issues,
          cameras: {
            total: cameras.length,
            online: onlineCameras.length,
            offline: offlineCameras.length
          },
          memory: {
            used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100, // MB
            total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100 // MB
          },
          events: {
            recent: recentEvents.length,
            today: recentEvents.filter(e => {
              const eventDate = new Date(e.timestamp);
              const today = new Date();
              return eventDate.getDate() === today.getDate() &&
                     eventDate.getMonth() === today.getMonth() &&
                     eventDate.getFullYear() === today.getFullYear();
            }).length
          }
        }
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({ success: false, error: 'Failed to get system health' });
    }
  });
 
  // Get system logs
  app.get('/api/system/logs', async (req: Request, res: Response) => {
    try {
      const { level, limit } = req.query;
      const logs: Array<{ timestamp: string; level: string; message: string; context?: string }> = [];

      // Log file paths
      const logsDir = path.join(__dirname, '../../logs');
      const errorLogFile = path.join(logsDir, 'error.log');
      const combinedLogFile = path.join(logsDir, 'combined.log');

      // Parse log file line by line
      const parseLogFile = (filePath: string, targetLevel?: string): Array<{ timestamp: string; level: string; message: string; context?: string }> => {
        const entries: Array<{ timestamp: string; level: string; message: string; context?: string }> = [];
        
        if (!fs.existsSync(filePath)) {
          return entries;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse log line format: [timestamp] [LEVEL] [context] message
          const match = line.match(/^\[([\d-T:.Z]+)\]\s+\[([A-Z]+)\](?:\s+\[([^\]]+)\])?\s+(.+)$/);
          
          if (match) {
            const [, timestamp, logLevel, context, message] = match;
            
            // Filter by level if specified
            if (targetLevel && logLevel.toLowerCase() !== targetLevel.toLowerCase()) {
              continue;
            }

            entries.push({
              timestamp,
              level: logLevel.toLowerCase(),
              message: message || '',
              context: context ? context.trim() : undefined
            });
          }
        }

        return entries;
      };

      // Read from combined log file (includes all levels)
      let parsedLogs = parseLogFile(combinedLogFile, level as string);
      
      // If level is 'error', also read from error log file and merge
      if (level === 'error' || !level) {
        const errorLogs = parseLogFile(errorLogFile, 'error');
        // Combine and deduplicate by timestamp
        const combined = [...parsedLogs, ...errorLogs];
        const seenTimestamps = new Set<string>();
        parsedLogs = combined.filter(entry => {
          if (seenTimestamps.has(entry.timestamp)) {
            return false;
          }
          seenTimestamps.add(entry.timestamp);
          return true;
        });
      }

      // Sort by timestamp (newest first)
      parsedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply limit
      const limitNum = limit ? parseInt(limit as string) : 100;
      const limitedLogs = parsedLogs.slice(0, Math.min(limitNum, 1000));

      res.json({
        success: true,
        logs: limitedLogs,
        total: parsedLogs.length,
        returned: limitedLogs.length
      });
    } catch (error) {
      console.error('Error getting system logs:', error);
      res.status(500).json({ success: false, error: 'Failed to get system logs' });
    }
  });

  // Clear system logs
  app.delete('/api/system/logs', async (req: Request, res: Response) => {
    try {
      const logsDir = path.join(__dirname, '../../logs');
      const errorLogFile = path.join(logsDir, 'error.log');
      const combinedLogFile = path.join(logsDir, 'combined.log');
      const accessLogFile = path.join(logsDir, 'access.log');

      const filesToClear = [errorLogFile, combinedLogFile, accessLogFile];
      let clearedCount = 0;

      for (const filePath of filesToClear) {
        if (fs.existsSync(filePath)) {
          // Empty the file instead of deleting it
          fs.writeFileSync(filePath, '', 'utf-8');
          clearedCount++;
        }
      }

      logger.info(`System logs cleared by user: ${clearedCount} file(s)`, 'API', { clearedCount });

      res.json({
        success: true,
        message: `${clearedCount} log file(s) cleared`,
        clearedCount
      });
    } catch (error) {
      console.error('Error clearing system logs:', error);
      res.status(500).json({ success: false, error: 'Failed to clear system logs' });
    }
  });

  // Detection image with overlays endpoint
  app.get('/detections/image/:imageId', async (req: Request, res: Response) => {
    try {
      const { imageId } = req.params;
      const { overlays } = req.query;

      // Look up the image file in the database
      const AppDataSource = (global as any).AppDataSource;
      
      if (!AppDataSource) {
        return res.status(503).json({
          success: false,
          error: 'Database not available'
        });
      }

      // Query for detection file by UUID or filename
      const query = `
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as file_uuid,
          COALESCE(df.storage_path, e.file_path) as file_path,
          COALESCE(df.storage_path, e.file_path) as imagePath,
          COALESCE(df.metadata, e.metadata) as metadata,
          COALESCE(df.camera_id, e.camera_id) as camera_id
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE df.file_uuid = $1
           OR e.file_path = $1
           OR df.original_filename = $1

        ORDER BY COALESCE(df.created_at, e.created_at) DESC
        LIMIT 1
      `;

      const results = await AppDataSource.query(query, [imageId]);

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

      // For now, serve the image without overlays
      // TODO: Implement overlay rendering using canvas or OpenCV if overlays=true
      const imageUrl = `/events/${detection.original_filename}`;

      res.json({
        success: true,
        imageUrl,
        imagePath: detection.storage_path,
        metadata: detection.metadata ? JSON.parse(detection.metadata) : null,
        overlaysEnabled: overlays === 'true',
        note: overlays === 'true' ? 'Overlay rendering not yet implemented' : undefined
      });

    } catch (error) {
      console.error('Error getting detection image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get detection image'
      });
    }
  });

  // Analytics endpoints
  
  // Get hourly analytics data
  app.get('/api/analytics/hourly', (req: Request, res: Response) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // Initialize hourly data array
      const hourlyData = Array(24).fill(null).map((_, hour) => ({ hour, count: 0 }));
      
      // Count events for each hour of today
      recentEvents.forEach(event => {
        const eventDate = new Date(event.timestamp);
        if (eventDate >= startOfDay && eventDate <= today) {
          const hour = eventDate.getHours();
          hourlyData[hour].count++;
        }
      });
      
      res.json({ success: true, hourlyData });
    } catch (error) {
      console.error('Error getting hourly analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to get hourly analytics' });
    }
  });

  // Get weekly analytics data
  app.get('/api/analytics/weekly', (req: Request, res: Response) => {
    try {
      const today = new Date();
      const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const weeklyEvents = recentEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= oneWeekAgo && eventDate <= today;
      });
      
      res.json({ 
        success: true, 
        weeklyData: {
          totalEvents: weeklyEvents.length,
          dailyBreakdown: Array(7).fill(null).map((_, dayIndex) => {
            const date = new Date(today.getTime() - dayIndex * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            
            const dayEvents = weeklyEvents.filter(event => {
              const eventDate = new Date(event.timestamp);
              return eventDate >= dayStart && eventDate < dayEnd;
            });
            
            return {
              date: dayStart.toISOString().split('T')[0],
              count: dayEvents.length
            };
          }).reverse()
        }
      });
    } catch (error) {
      console.error('Error getting weekly analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to get weekly analytics' });
    }
  });

  // Get monthly analytics data
  app.get('/api/analytics/monthly', (req: Request, res: Response) => {
    try {
      const today = new Date();
      const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      
      const monthlyEvents = recentEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= oneMonthAgo && eventDate <= today;
      });
      
      res.json({ 
        success: true, 
        monthlyData: {
          totalEvents: monthlyEvents.length,
          weeklyBreakdown: Array(4).fill(null).map((_, weekIndex) => {
            const weekStart = new Date(today.getTime() - (weekIndex + 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            const weekEvents = monthlyEvents.filter((event: MotionEvent) => {
              const eventDate = new Date(event.timestamp);
              return eventDate >= weekStart && eventDate < weekEnd;
            });
            
            return {
              week: `Week ${4 - weekIndex}`,
              count: weekEvents.length
            };
          }).reverse()
        }
      });
    } catch (error) {
      console.error('Error getting monthly analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to get monthly analytics' });
    }
  });

  // Get response time analytics
  app.get('/api/analytics/response-time', (req: Request, res: Response) => {
    try {
      // Calculate average response time based on recent events
      // For now, we'll simulate this based on system performance
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Simple heuristic: lower memory usage = faster response time
      const memoryFactor = memoryUsage.heapUsed / memoryUsage.heapTotal;
      const baseResponseTime = 1.5; // Base 1.5 seconds
      const responseTime = baseResponseTime + (memoryFactor * 2); // Add up to 2 seconds based on memory
      
      res.json({ 
        success: true, 
        responseTime: {
          average: Math.round(responseTime * 100) / 100, // Round to 2 decimals
          recent: recentEvents.slice(0, 10).map((_, index) => ({
            timestamp: new Date(Date.now() - index * 60000).toISOString(),
            responseTime: Math.round((responseTime + (Math.random() - 0.5) * 0.5) * 100) / 100
          })).reverse()
        }
      });
    } catch (error) {
      console.error('Error getting response time analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to get response time analytics' });
    }
  });

  

  

  

  // =====================================
  // PERSON AND FACIAL DETECTION ROUTES
  // =====================================
  
  // Manual person detection trigger
  app.post('/api/detection/person/:cameraId/trigger', async (req: Request, res: Response) => {
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
        addAlert({
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
  app.post('/api/detection/face/:cameraId/trigger', async (req: Request, res: Response) => {
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
          addAlert({
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
  app.get('/api/detection/person/settings', (req: Request, res: Response) => {
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
  app.get('/api/opencv/status', async (req: Request, res: Response) => {
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
  app.put('/api/detection/person/settings', (req: Request, res: Response) => {
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
  app.get('/api/detection/face/settings', (req: Request, res: Response) => {
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
  app.put('/api/detection/face/settings', (req: Request, res: Response) => {
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
  app.get('/api/detection/motion/settings', (req: Request, res: Response) => {
    try {
      const optimizedMotionDetector = (global as any).optimizedMotionDetector;
      if (!optimizedMotionDetector) {
        return res.status(404).json({ success: false, error: 'Motion detector not initialized' });
      }

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
  app.put('/api/detection/motion/settings', (req: Request, res: Response) => {
    try {
      const { cameraId, sensitivity, requiredConsecutiveFrames, minContourArea, useGaussianBlur, blurKernelSize, timeZones } = req.body;
      const optimizedMotionDetector = (global as any).optimizedMotionDetector;

      if (!optimizedMotionDetector) {
        return res.status(404).json({ success: false, error: 'Motion detector not initialized' });
      }

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
   app.get('/api/detection/face/persons', async (req: Request, res: Response) => {
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
  app.post('/api/detection/face/persons', upload.single('image'), async (req: Request, res: Response) => {
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
  
  // Get detection events
  app.get('/api/detection/events', async (req: Request, res: Response) => {
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
  app.post('/api/motion/:cameraId/analyze', async (req: Request, res: Response) => {
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
  
  // =====================================
  // BATCH OPENCV DETECTION ROUTES
  // =====================================
  
  interface BatchDetectionRequest {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }

  interface BatchDetectionProgress {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    currentImage?: string;
    percentage: number;
  }

  // Store active batches
  const activeBatches = new Map<string, BatchDetectionProgress>();

  // Get events for batch processing - reads from real motion event files
  async function getEventsForBatch(request: BatchDetectionRequest): Promise<any[]> {
    try {
      // Build query conditions
      const conditions: string[] = ["event_type IN ('event_motion', 'event_face')"];
      const values: any[] = [];
      let paramIndex = 1;

      if (request.startDate) {
        conditions.push(`timestamp >= $${paramIndex++}`);
        values.push(new Date(request.startDate));
      }

      if (request.endDate) {
        conditions.push(`timestamp <= $${paramIndex++}`);
        values.push(new Date(request.endDate));
      }

      const limit = request.limit || 1000; // Default limit to prevent too many results
      const whereClause = `WHERE ${conditions.join(' AND ')}`;
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

      // Transform results to match expected event format
      const allEvents = results.map((row: any) => {
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

        // Determine labels from file type and metadata
        let labels = ['motion'];
        if (row.file_type === 'event_face') {
          labels = ['face'];
        } else if (row.file_type === 'event_motion') {
          labels = ['motion'];
        }

        return {
          id: row.file_uuid,
          imageId: row.original_filename,
          timestamp: new Date(row.capture_timestamp).toISOString(),
          imagePath: row.storage_path,
          type: row.file_type,
          confidence: confidence,
          labels: labels,
          cameraName: row.camera_id || 'unknown'
        };
      });

      return allEvents;
    } catch (error) {
      console.error('Error getting events for batch:', error);
      return [];
    }
  }

  // Batch detection endpoint - process all events with OpenCV
  // Note: Rate limiting should be applied here using rateLimitMiddleware('BATCH')
  // TODO: Move to separate router file to apply rate limiting properly
  app.post('/api/detection/batch-process', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, limit } = req.body;
      
      console.log('Starting batch detection for events:', { startDate, endDate, limit });
      
      // Get events to process
      const events = await getEventsForBatch({ startDate, endDate, limit });
      
      if (events.length === 0) {
        return res.json({
          success: true,
          summary: {
            totalEvents: 0,
            personsDetected: 0,
            facesDetected: 0,
            vehiclesDetected: 0,
            motionEvents: 0,
            averageProcessingTime: 0,
            processingErrors: 0
          },
          results: [],
          message: 'No events found to process'
        });
      }

      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize progress tracking
      activeBatches.set(batchId, {
        total: events.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0
      });

      // Process events
      const results: any[] = [];
      let totalPersons = 0;
      let totalFaces = 0;
      let totalVehicles = 0;
      let totalMotion = 0;
      let processingTimes: number[] = [];
      let errors = 0;

      const { getOpenCVClient } = await import('../services/opencvMicroserviceClient.js');
      const openCVClient = getOpenCVClient();

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const progress = activeBatches.get(batchId);
        
        if (progress) {
          progress.currentImage = event.imageId || event.id;
          progress.percentage = Math.round((i / events.length) * 100);
          activeBatches.set(batchId, progress);
        }

        try {
          // Check if event has an image path
          const imagePath = event.imagePath || (event.imageId ? path.join(__dirname, '../../data/events', event.imageId) : null);

          if (!imagePath || !fs.existsSync(imagePath)) {
            results.push({
              eventId: event.id,
              imageId: event.imageId,
              timestamp: event.timestamp,
              detections: [],
              faceDetections: [],
              error: 'Image file not found'
            });

            if (progress) {
              progress.failed++;
              activeBatches.set(batchId, progress);
            }
            errors++;
            continue;
          }

          // Read image file to buffer
          const imageBuffer = fs.readFileSync(imagePath);

          // Run object detection
          const detectionResult = await consolidatedDetectionService.detectObjects('default', imageBuffer);

          // Run face recognition
          const faceResult = await consolidatedDetectionService.detectFaces('default', imageBuffer);

          results.push({
            eventId: event.id,
            imageId: event.imageId,
            timestamp: event.timestamp,
            detections: detectionResult.detections || [],
            faceDetections: faceResult.faces || [],
            success: true
          });

          // Count detections
          if (detectionResult.detections) {
            detectionResult.detections.forEach((d: any) => {
              if (d.class === 'person') totalPersons++;
              else if (d.class === 'vehicle') totalVehicles++;
              else if (d.class === 'motion') totalMotion++;
            });
          }

          if (faceResult.faces) {
            totalFaces += faceResult.faces.length;
          }

          if (progress) {
            progress.succeeded++;
            activeBatches.set(batchId, progress);
          }
        } catch (error: any) {
          console.error(`Error processing event ${event.id}:`, error);
          results.push({
            eventId: event.id,
            imageId: event.imageId,
            timestamp: event.timestamp,
            detections: [],
            faceDetections: [],
            error: error.message
          });
          
          if (progress) {
            progress.failed++;
            activeBatches.set(batchId, progress);
          }
          errors++;
        }

        // Add small delay to avoid overwhelming the service
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Finalize progress
      const finalProgress = activeBatches.get(batchId);
      if (finalProgress) {
        finalProgress.percentage = 100;
        finalProgress.processed = events.length;
        activeBatches.set(batchId, finalProgress);
      }

      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      const summary = {
        totalEvents: events.length,
        personsDetected: totalPersons,
        facesDetected: totalFaces,
        vehiclesDetected: totalVehicles,
        motionEvents: totalMotion,
        averageProcessingTime: Math.round(avgProcessingTime),
        processingErrors: errors
      };

      // Save batch job and results to PostgreSQL database
      try {
        const db = await getBatchProcessingDatabase();

        const now = new Date();

        // Create batch job record
        await db.createJob({
          id: batchId,
          status: 'completed',
          start_time: new Date(now.getTime() - avgProcessingTime * events.length),
          end_time: now,
          total_images: events.length,
          processed_images: events.length,
          successful_images: totalPersons + totalFaces,
          failed_images: errors,
          person_detections: totalPersons,
          face_detections: totalFaces,
          known_faces: 0,
          unknown_faces: totalFaces,
          processing_time_ms: Math.round(avgProcessingTime * events.length),
          options_json: JSON.stringify({ startDate, endDate, limit }),
          error_message: undefined
        });

        // Save processed images to database
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const event = events[i];

          if (result.success) {
            await db.addProcessedImage({
              id: `${batchId}_${result.eventId}_${Date.now()}_${i}`,
              job_id: batchId,
              filename: result.imageId || result.eventId,
              file_path: event.imagePath || '',
              camera_id: event.cameraId || 'unknown',
              image_timestamp: new Date(result.timestamp),
              file_size: 0,
              person_count: result.detections?.filter((d: any) => d.class === 'person').length || 0,
              face_count: result.faceDetections?.length || 0,
              known_face_count: 0,
              unknown_face_count: result.faceDetections?.length || 0,
              processing_time_ms: 0,
              status: 'success',
              detection_json: JSON.stringify(result),
              file_hash: result.eventId
            });
          }
        }
        console.log(`Batch ${batchId} saved to PostgreSQL database`);
      } catch (dbError) {
        console.error('Failed to save batch to database:', dbError);
      }

      res.json({
        success: true,
        batchId,
        progress: activeBatches.get(batchId),
        summary,
        results,
        message: `Successfully processed ${events.length} events`
      });
    } catch (error: any) {
      console.error('Batch detection error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get batch progress
  app.get('/api/detection/batch-progress/:batchId', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;

      const progress = activeBatches.get(batchId);

      if (!progress) {
        // Try to get from database
        const db = await getBatchProcessingDatabase();
        const job = await db.getJob(batchId);
        if (job) {
          return res.json({
            success: true,
            progress: {
              total: job.total_images,
              processed: job.processed_images,
              succeeded: job.successful_images,
              failed: job.failed_images,
              percentage: job.status === 'completed' ? 100 : 0
            },
            status: job.status,
            summary: {
              totalEvents: job.total_images,
              personsDetected: job.person_detections,
              facesDetected: job.face_detections,
              vehiclesDetected: 0,
              motionEvents: 0,
              averageProcessingTime: job.processing_time_ms || 0,
              processingErrors: job.failed_images
            },
            isFromDatabase: true
          });
        }
        return res.status(404).json({
          success: false,
          error: 'Batch not found'
        });
      }

      res.json({
        success: true,
        progress
      });
    } catch (error: any) {
      console.error('Get batch progress error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get today's events for batch processing
  app.get('/api/detection/today-events', async (req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const events = await getEventsForBatch({
        startDate: today.toISOString(),
        endDate: tomorrow.toISOString()
      });
      
      res.json({
        success: true,
        events: events.length,
        date: today.toISOString()
      });
    } catch (error: any) {
      console.error('Get today events error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // API routes config log disabled - console.log('API routes configured');

  // ===== BATCH PROCESSING ROUTES =====

  // Get available time ranges
  app.get('/api/batch/time-ranges', async (req: Request, res: Response) => {
    try {
      const ranges = await batchProcessingService.getAvailableTimeRanges();
      res.json({
        success: true,
        ranges
      });
    } catch (error: any) {
      console.error('Error getting time ranges:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get all batch jobs
  app.get('/api/batch/jobs', async (req: Request, res: Response) => {
    try {
      let jobs = batchProcessingService.getAllJobs();
      
      if (jobs.length === 0) {
        try {
          const db = await getBatchProcessingDatabase();
          const dbJobs = await db.getJobs({ limit: 50 });
          if (dbJobs.length > 0) {
            jobs = dbJobs.map((job: any) => ({
              id: job.id,
              status: job.status,
              startTime: job.start_time ? new Date(job.start_time) : undefined,
              endTime: job.end_time ? new Date(job.end_time) : undefined,
              progress: {
                total: job.total_images || 0,
                processed: job.processed_images || 0,
                successful: job.successful_images || 0,
                failed: job.failed_images || 0
              },
              options: JSON.parse(job.options_json || '{}'),
              error: job.error_message
            }));
          }
        } catch (dbError) {
          console.warn('Could not fetch batch jobs from database:', dbError);
        }
      }
      
      res.json({
        success: true,
        jobs
      });
    } catch (error: any) {
      console.error('Error getting jobs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get batch statistics
  app.get('/api/batch/stats', async (req: Request, res: Response) => {
    try {
      const stats = await batchProcessingService.getJobSummary();
      res.json({
        success: true,
        stats: stats || {
          total_jobs: 0,
          queued_jobs: 0,
          running_jobs: 0,
          completed_jobs: 0,
          failed_jobs: 0,
          cancelled_jobs: 0
        }
      });
    } catch (error: any) {
      console.error('Error getting batch stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get available events for batch processing
  app.get('/api/batch/events/available', async (req: Request, res: Response) => {
    try {
      const { startTime, endTime, cameraIds } = req.query;
      
      const events = await batchProcessingService.getAvailableEvents({
        startTime: new Date(startTime as string),
        endTime: new Date(endTime as string),
        cameraIds: cameraIds ? (cameraIds as string).split(',') : undefined
      });
      
      res.json({
        success: true,
        events: events
      });
    } catch (error: any) {
      console.error('Error getting available events:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get single processed image with full details
  app.get('/api/batch/processed-images/:id', async (req: Request, res: Response) => {
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

  // Simple batch processing function
  async function processBatchDetection(jobId: string, options: any) {
    try {
      console.log(`Starting batch processing job ${jobId}`);

      // Get available events from events table
      const events = await AppDataSource.query(`
        SELECT
          COALESCE(df.file_uuid::text, e.id::text) as file_id,
          COALESCE(df.file_uuid::text, e.id::text) as file_uuid,
          COALESCE(df.original_filename, e.file_path) as filename,
          COALESCE(df.capture_timestamp, e.timestamp) as timestamp,
          COALESCE(df.camera_id, e.camera_id) as cameraId,
          COALESCE(df.storage_path, e.file_path) as filePath
        FROM events e
        LEFT JOIN detection_files df ON e.file_path = df.storage_path OR e.file_path LIKE '%' || df.original_filename
        WHERE COALESCE(df.file_type, e.event_type) IN ('event_face', 'event_motion')
          AND COALESCE(df.capture_timestamp, e.timestamp) >= $1
          AND COALESCE(df.capture_timestamp, e.timestamp) <= $2
        ORDER BY COALESCE(df.capture_timestamp, e.timestamp) DESC
        LIMIT 1000
      `, [new Date(options.timeRange.start), new Date(options.timeRange.end)]);

      console.log(`Found ${events.length} events to process`);

      if (events.length === 0) {
        console.log('No events to process');
        return;
      }

      // Import required modules dynamically
      const crypto = await import('crypto');

      let processed = 0;
      let successful = 0;
      let failed = 0;

      // Process in batches of 10
      const batchSize = 10;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        const imagePaths = batch.map((e: any) => e.filepath);

        try {
          // Check if files exist
          const existingPaths = imagePaths.filter((path: string) => fs.existsSync(path));
          if (existingPaths.length === 0) continue;

          // Create form data for batch detection
          const form = new FormData();
          existingPaths.forEach((imagePath: string, index: number) => {
            const fileBuffer = fs.readFileSync(imagePath);
            const blob = new Blob([fileBuffer]);
            form.append('images', blob, `image_${index}.jpg`);
          });
          form.append('batchHash', `batch_${jobId}_${i}`);

          // Call OpenCV batch detection
          const response = await fetch(`${process.env.OPENCV_SERVICE_URL || 'http://opencv:8084'}/detect-batch`, {
            method: 'POST',
            body: form
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const batchResult = await response.json();

          if (batchResult.success && batchResult.results) {
            // Update events metadata for each result
            for (let j = 0; j < batchResult.results.length && j < batch.length; j++) {
              const result = batchResult.results[j];
              const event = batch[j];

              if (result.success && result.detections) {
                const metadata = {
                  detections: result.detections.filter((d: any) =>
                    (options.detectionTypes.includes('person') || options.detectionTypes.includes('both')) &&
                    d.class === 'person' ? true :
                    (options.detectionTypes.includes('face') || options.detectionTypes.includes('both')) &&
                    d.class === 'face' ? true : false
                  ).filter((d: any) => d.confidence >= options.confidenceThreshold),
                  detected_at: new Date().toISOString(),
                  detection_types: [...new Set(result.detections.map((d: any) => d.class))],
                  batch_job_id: jobId,
                  processing_time_ms: result.processingTime || 0
                };

                // Generate file hash for lookup
                const fileHash = crypto.createHash('sha256')
                  .update(event.filename + event.timestamp)
                  .digest('hex');

                // Update metadata
                await AppDataSource.query(`
                  UPDATE events
                  SET metadata = $1::text
                  WHERE file_path = $2
                `, [JSON.stringify(metadata), event.filepath]);

                successful++;
              }
            }
          }

          processed += batch.length;

          if (i % 50 === 0) {
            console.log(`Processed ${processed}/${events.length} events (${successful} successful, ${failed} failed)`);
          }

        } catch (error) {
          console.error(`Error processing batch starting at ${i}:`, error);
          failed += batch.length;
          processed += batch.length;
        }
      }

      console.log(`Batch processing completed: ${processed} processed, ${successful} successful, ${failed} failed`);

    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  // Start batch processing
  app.post('/api/batch/start', async (req: Request, res: Response) => {
    try {
      const options = req.body;

      const jobId = await batchProcessingService.startBatchProcessing({
        timeRange: {
          start: new Date(options.timeRange?.start || Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(options.timeRange?.end || Date.now())
        },
        cameraIds: options.cameraIds,
        detectionTypes: options.detectionTypes || ['both'],
        confidenceThreshold: options.confidenceThreshold || 0.7,
        saveResults: options.saveResults !== false,
        outputFormat: options.outputFormat || 'database'
      });

      res.json({
        success: true,
        jobId
      });
    } catch (error: any) {
      console.error('Error starting batch processing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Cancel batch job
  app.post('/api/batch/jobs/:jobId/cancel', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      
      const success = await batchProcessingService.cancelJob(jobId);
      
      res.json({ success });
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get batch job results
  app.get('/api/batch/jobs/:jobId/results', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      
      const job = batchProcessingService.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
      
      res.json({
        success: true,
        job
      });
    } catch (error: any) {
      console.error('Error getting job results:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Download batch job results (serve file)
  app.get('/api/batch/jobs/:jobId/download', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      
      const job = batchProcessingService.getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
      
      if (job.status !== 'completed' || !job.results) {
        return res.status(400).json({
          success: false,
          error: 'Job not completed or no results available'
        });
      }
      
      const outputPath = path.join(__dirname, '../../public/batch-results', `${jobId}.json`);
      
      if (!fs.existsSync(outputPath)) {
        return res.status(404).json({
          success: false,
          error: 'Results file not found'
        });
      }
      
      res.download(outputPath, `batch_results_${jobId}.json`);
    } catch (error: any) {
      console.error('Error downloading batch results:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get annotated image with detection bounding boxes
  app.get('/api/batch/annotated/:filename', async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const opencvUrl = process.env.OPENCV_SERVICE_URL || 'http://opencv:8084';

      const result = await AppDataSource.query(
        `SELECT file_path FROM events WHERE file_path LIKE '%${filename}' LIMIT 1`
      );

      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Image not found in database' });
      }

      const filePath = result[0].file_path;

      const response = await fetch(`${opencvUrl}/annotate-by-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });

      if (!response.ok) {
        return res.status(502).json({ success: false, error: 'OpenCV service error' });
      }

      const arrayBuffer = await response.arrayBuffer();
      res.set('Content-Type', 'image/jpeg');
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error('Error getting annotated image:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get processed images with detections for viewing
  app.get('/api/batch/processed-images', async (req: Request, res: Response) => {
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
        query += ` AND detection_json->'persons' @> $${paramIndex++}::jsonb`;
        params.push(JSON.stringify([{"class": objectClass}]));
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
  app.get('/api/batch/processed-images/:id', async (req: Request, res: Response) => {
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

  app.get('/api/highlights/:date', async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const { 
        limit = '50',
        sort = 'recent' 
      } = req.query;

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

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

      const query = `
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
        LIMIT $3
      `;

      const results = await AppDataSource.query(query, [startDate, endDate, parseInt(limit as string)]);

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

  app.get('/api/highlights/:date/summary', async (req: Request, res: Response) => {
    try {
      const { date } = req.params;

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

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

  // Configure detection routes (with enhanced functionality)
  app.use('/api/detection', detectionRoutes);

  // Configure face embedding routes
  app.use('/api/face-embeddings', faceEmbeddingRoutes);

  // Configure face config routes
  app.use('/api/face-config', faceConfigRoutes);

  // Configure detection redo routes
  configureDetectionRedoRoutes(app);
}