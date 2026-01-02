import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { StreamManager, Camera, streamManager } from '../streams/rtspManager.js';
import { validate, commonSchemas } from '../middleware/validation.js';
import { createAuthRateLimit, createStreamRateLimit } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';
import auditLogger from '../utils/auditLogger.js';
// import logRoutes from './logRoutes.js';
import { generateTestJpegFrame } from '../utils/testImageGenerator.js';
import { AppDataSource } from '../database.js';
// import { Event } from '../models/Event.js'; // Temporarily disabled
import { FindManyOptions } from 'typeorm';
// Use global detection services initialized in main server file
// import { getMotionDetector as getGlobalMotionDetector } from '../detection/simpleMotionDetection.js';
// import { getObjectDetectionService as getGlobalObjectDetectionService } from '../detection/objectDetection.js';
// import { getFacialRecognitionService as getGlobalFacialRecognitionService } from '../detection/facialRecognition.js';
// Using global variables set up in index.ts
import { getObjectDetectionService as getGlobalObjectDetectionService } from '../detection/objectDetectionOpenCV.js';
import { getFacialRecognitionService as getGlobalFacialRecognitionService } from '../detection/facialRecognitionOpenCV.js';
import { batchProcessingService } from '../services/batchProcessingService.js';
import { getBatchProcessingDatabase } from '../services/batchProcessingDatabasePostgres.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define events directory - use absolute path for Docker compatibility
const EVENTS_DIR = path.join(process.cwd(), 'public', 'events');

// Ensure events directory exists
if (!fs.existsSync(EVENTS_DIR)) {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
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

// Store system settings in memory
let systemSettings: SystemSettings = {
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
  app.get('/api/alerts', (req: Request, res: Response) => {
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
  app.post('/api/alerts/:id/acknowledge', (req: Request, res: Response) => {
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
  app.delete('/api/alerts/:id', (req: Request, res: Response) => {
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
  app.get('/api/settings', (req: Request, res: Response) => {
    try {
      res.json({ success: true, settings: systemSettings });
    } catch (error) {
      console.error('Error getting system settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get system settings' });
    }
  });

  // Update system settings
  app.put('/api/settings', (req: Request, res: Response) => {
    try {
      const { general, storage, notifications } = req.body;
      if (general) {
        systemSettings.general = { ...systemSettings.general, ...general };
      }
      if (storage) {
        systemSettings.storage = { ...systemSettings.storage, ...storage };
      }
      if (notifications) {
        systemSettings.notifications = { ...systemSettings.notifications, ...notifications };
      }
      res.json({ success: true, message: 'Settings updated successfully', settings: systemSettings });
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

  // Simple JPEG frame endpoint for camera streams (easier for browser img tags)
  app.get('/snapshot/:cameraId.jpg', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      if (!camera.isActive || !camera.lastFrame) {
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
      
      console.log(`*** SNAPSHOT REQUEST for ${cameraId} - frame size: ${camera.lastFrame.length} ***`);
      
      // Set proper headers for single JPEG image
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': camera.lastFrame.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      
      res.end(camera.lastFrame);
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
        return {
          id: camera.id,
          name: camera.name,
          rtspUrl: camera.rtspUrl,
          isActive: camera.isActive,
          frameRate: camera.frameRate,
          resolution: camera.resolution,
          nightMode: camera.nightMode,
          status,
          lastError: camera.lastError || undefined,
          retryCount: camera.retryCount || 0
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
        id: '', // Will be auto-generated
        name,
        rtspUrl,
        username,
        password,
        frameRate: frameRate || 15,
        resolution: resolution || '640x480',
        nightMode: false,
        retryCount: 0
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

      const { name, rtspUrl, username, password, frameRate, resolution, nightMode } = req.body;
      
      // Validate required fields
      const updates: Partial<Camera> = {};
      if (name !== undefined) updates.name = name;
      if (rtspUrl !== undefined) updates.rtspUrl = rtspUrl;
      if (username !== undefined) updates.username = username;
      if (password !== undefined) updates.password = password;
      if (frameRate !== undefined) {
        if (frameRate < 1 || frameRate > 30) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid frame rate. Must be between 1 and 30.',
            field: 'frameRate'
          });
        }
        updates.frameRate = frameRate;
      }
      if (resolution !== undefined) {
        if (!resolution.match(/^\d+x\d+$/)) {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid resolution format. Must be in format WIDTHxHEIGHT (e.g. 1280x720).',
            field: 'resolution'
          });
        }
        updates.resolution = resolution;
      }
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

      // Mark camera as active for test streaming
      (camera as any).isActive = true;
      (camera as any).isTestStream = true;

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

      // Start real RTSP stream
      streamManager.startStream(req.params.id);

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
      const { resolution } = req.body;
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
      const process = streamManager.getProcess(cameraId);
      const isTestStream = (camera as any).isTestStream;
      
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
        
        // Send frames at camera's frame rate (default 15 fps)
        // Send frames at camera's frame rate (default 15 fps)
        const fps = camera.frameRate || 15;
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

  // Get historical motion events with pagination and filtering (file-based implementation)
  app.get('/api/events/history', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const cameraIdFilter = req.query.cameraId as string;
      const searchQuery = req.query.searchQuery as string;
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      const sortBy = req.query.sortBy as string || 'newest';
      const detectionType = req.query.detectionType as string || 'all';

      const eventsDir = EVENTS_DIR;
      let allEvents: any[] = [];

      try {
        if (fs.existsSync(eventsDir)) {
          const files = fs.readdirSync(eventsDir)
            .filter(file => file.endsWith('.jpg'));

          allEvents = files.map(file => {
            const parts = file.split('_');
            const eventType = parts[0] || 'motion';
            const cameraId = parts[1]?.replace('cam', '') || 'unknown';
            let timestamp = new Date().toISOString();

            if (parts.length >= 3) {
              const timestampPart = parts[2]?.split('.')[0];
              if (timestampPart) {
                // Check if timestampPart is a numeric timestamp (like 1763535628378)
                // Unix timestamps in milliseconds for 2025 would be ~1700000000000+ (much larger than 9999)
                const numericTimestamp = parseInt(timestampPart, 10);
                const isPurelyNumeric = !isNaN(numericTimestamp) && /^\d+$/.test(timestampPart) && timestampPart.length > 4;
                if (isPurelyNumeric) {
                  // It's a numeric timestamp in milliseconds (not just a year like 2025)
                  const parsedDate = new Date(numericTimestamp);
                  if (!isNaN(parsedDate.getTime())) {
                    timestamp = parsedDate.toISOString();
                  }
                } else {
                  // It's in format YYYY-MM-DDTHH-mm-ss-msZ
                  // Convert timestamp format from filename to ISO
                  if (timestampPart.includes('T')) { // Contains date-time separator
                    // Split on 'T' to separate date and time parts
                    const [datePart, timePartWithZ] = timestampPart.split('T');
                    if (datePart && timePartWithZ) {
                      // Split time part on hyphens to get hours, minutes, seconds, milliseconds
                      const timeParts = timePartWithZ.split('-');

                      if (timeParts.length >= 3) {
                        let hours = timeParts[0].padStart(2, '0');
                        let minutes = timeParts[1].padStart(2, '0');
                        let seconds = timeParts[2].padStart(2, '0');
                        let milliseconds = '000';

                        // Check if there's a milliseconds part (the part after third hyphen, before Z)
                        if (timeParts.length >= 4) {
                          // Remove Z from milliseconds if present
                          milliseconds = timeParts[3].replace('Z', '').padStart(3, '0');
                        } else if (timeParts.length === 3) {
                          // The last part (seconds) might have Z attached if no milliseconds
                          if (timeParts[2].includes('Z')) {
                            seconds = timeParts[2].replace('Z', '').padStart(2, '0');
                            milliseconds = '000';
                          }
                        }

                        // Create proper ISO timestamp with colons in time part
                        const isoTimestamp = `${datePart}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
                        const parsedDate = new Date(isoTimestamp);
                        if (!isNaN(parsedDate.getTime())) {
                          timestamp = parsedDate.toISOString();
                        }
                      }
                    }
                  }
                }
              }
            }

            // Determine event type from filename
            let labels = ['motion'];
            if (file.includes('face')) {
              labels = ['face'];
            } else if (file.includes('person')) {
              labels = ['person'];
            }

            return {
              id: `evt_${file}`,
              cameraId,
              timestamp,
              imagePath: `/events/${file}`,
              confidence: 0.75, // Default confidence (75%)
              labels,
              location: `Camera ${cameraId}`,
              duration: 0,
              cameraName: `Camera ${cameraId}`,
              event_type: eventType
            };
          });

          // Apply filtering
          allEvents = allEvents.filter(event => {
            // Camera filter
            if (cameraIdFilter && cameraIdFilter !== 'all' && event.cameraId !== cameraIdFilter) {
              return false;
            }

            // Detection type filter
            if (detectionType && detectionType !== 'all' && !event.labels.includes(detectionType)) {
              return false;
            }

            // Date range filter
            const eventDate = new Date(event.timestamp);
            if (startDateStr) {
              const startDate = new Date(startDateStr);
              if (eventDate < startDate) return false;
            }
            if (endDateStr) {
              const endDate = new Date(endDateStr);
              if (eventDate > endDate) return false;
            }

            // Search query filter (basic implementation)
            if (searchQuery) {
              const searchLower = searchQuery.toLowerCase();
              if (!event.cameraName.toLowerCase().includes(searchLower) &&
                  !event.labels.some((label: string) => label.toLowerCase().includes(searchLower))) {
                return false;
              }
            }

            return true;
          });

          console.log(`Filtering events with startDate: ${startDateStr}, endDate: ${endDateStr}. Found ${allEvents.length} events.`);

          // Apply sorting
          allEvents.sort((a, b) => {
            if (sortBy === 'oldest') {
              return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            } else {
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }
          });
        }
      } catch (error) {
        console.warn('Error reading events directory:', error);
      }

      // Apply pagination
      const totalEvents = allEvents.length;
      const totalPages = Math.ceil(totalEvents / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedEvents = allEvents.slice(startIndex, endIndex);

      res.json({
        success: true,
        events: paginatedEvents,
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

  // Search events (alias for history with search query)
  app.get('/api/events/search', (req: Request, res: Response) => {
    // This endpoint can simply call the history endpoint with the search query
    // Note: This is a simplified approach. For more complex scenarios, consider refactoring into a shared function.
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const cameraIdFilter = req.query.cameraId as string;
      const searchQuery = req.query.searchQuery as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

      const eventsDir = EVENTS_DIR;
      const allFiles = fs.readdirSync(eventsDir)
        .filter((file: string) => file.endsWith('.jpg'))
        .map((file: string) => {
          const parts = file.split('_');
          const cameraId = parts[1] || 'unknown';
          let timestamp = new Date().toISOString();
          if (parts.length >= 3) {
        const timestampPart = parts[2]?.split('.')[0]; // e.g., "2025-06-29T07-24-23-640Z"
        if (timestampPart) {
          // Convert "YYYY-MM-DDTHH-mm-ss-msZ" to "YYYY-MM-DDTHH:mm:ss.msZ"
          const datePart = timestampPart.substring(0, 10); // "YYYY-MM-DD"
          const timePartWithHyphens = timestampPart.substring(11); // "HH-mm-ss-msZ"
          const timeParts = timePartWithHyphens.split('-'); // ["HH", "mm", "ss", "msZ"]
          
          let ms = 0;
          let formattedTime = '';

          if (timeParts.length === 4) {
            // Has milliseconds
            ms = parseInt(timeParts[3].replace('Z', ''), 10);
            formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}.${ms}Z`;
          } else if (timeParts.length === 3) {
            // No milliseconds
            formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}Z`;
          } else {
            console.warn(`Unexpected time format in filename: ${timestampPart}`);
            // Fallback to current time or handle error
            formattedTime = new Date().toISOString().substring(11, 23) + 'Z'; // Just time part
          }

          const isoTimestamp = `${datePart}T${formattedTime}`;
          const parsedDate = new Date(isoTimestamp);

          if (!isNaN(parsedDate.getTime())) {
            timestamp = parsedDate.toISOString();
          } else {
            console.warn(`Failed to parse timestamp from filename: ${timestampPart}. Using current time.`);
          }
        }
      }
          return {
            id: `evt_${file}`,
            cameraId,
            timestamp,
            imagePath: `/events/${file}`,
            confidence: 75, // Default confidence
            labels: ['motion'],
            location: 'Unknown',
            duration: 0,
            cameraName: cameraId // Assuming cameraName is same as cameraId for now
          };
        })
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first

      let filteredEvents = allFiles;

      if (cameraIdFilter && cameraIdFilter !== 'all') {
        filteredEvents = filteredEvents.filter((event: MotionEvent) => event.cameraId === cameraIdFilter);
      }

      if (searchQuery) {
        const lowerCaseSearchQuery = searchQuery.toLowerCase();
        filteredEvents = filteredEvents.filter((event: MotionEvent) =>
          event.cameraId.toLowerCase().includes(lowerCaseSearchQuery) ||
          event.labels?.some(label => label.toLowerCase().includes(lowerCaseSearchQuery)) ||
          event.location?.toLowerCase().includes(lowerCaseSearchQuery)
        );
      }

      if (startDate) {
        filteredEvents = filteredEvents.filter((event: MotionEvent) => new Date(event.timestamp) >= startDate);
      }

      if (endDate) {
        filteredEvents = filteredEvents.filter((event: MotionEvent) => new Date(event.timestamp) <= endDate);
      }

      const totalEvents = filteredEvents.length;
      const totalPages = Math.ceil(totalEvents / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

      res.json({
        success: true,
        events: paginatedEvents,
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

  // Get all motion events (what the frontend expects)
  app.get('/api/motion/events', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Get events from files in the events directory
      const eventsDir = EVENTS_DIR;
      let allEvents: MotionEvent[] = [];
      
      try {
        if (fs.existsSync(eventsDir)) {
          const files = fs.readdirSync(eventsDir)
            .filter(file => file.endsWith('.jpg'))
            .sort((a, b) => {
              const timeA = parseTimestampFromFilename(a);
              const timeB = parseTimestampFromFilename(b);
              return timeB - timeA; // Newest first
            })
            .slice(0, limit);

          allEvents = files.map(file => {
            const parts = file.split('_');
            const cameraId = parts[1] || 'unknown';
            let timestamp = new Date().toISOString();
            
            if (parts.length >= 3) {
              const timestampPart = parts[2]?.split('.')[0];
              if (timestampPart) {
                const datePart = timestampPart.substring(0, 10);
                const timePartWithHyphens = timestampPart.substring(11);
                const timeParts = timePartWithHyphens.split('-');
                
                let formattedTime = '';
                if (timeParts.length === 4) {
                  const ms = parseInt(timeParts[3].replace('Z', ''), 10);
                  formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}.${ms}Z`;
                } else if (timeParts.length === 3) {
                  formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}Z`;
                }
                
                const isoTimestamp = `${datePart}T${formattedTime}`;
                const parsedDate = new Date(isoTimestamp);
                if (!isNaN(parsedDate.getTime())) {
                  timestamp = parsedDate.toISOString();
                }
              }
            }
            
            return {
              id: `evt_${file}`,
              cameraId,
              timestamp,
              imagePath: `/events/${file}`,
              confidence: 75,
              duration: 0,
              cameraName: cameraId,
              labels: ['motion'],
              location: cameraId
            };
          });
        }
      } catch (error) {
        console.warn('Error reading events directory:', error);
      }
      
      // Combine and deduplicate - only use file-based events since in-memory events are disabled
      const combinedEvents = [...allEvents];
      const uniqueEvents = combinedEvents.filter((event, index, self) => 
        index === self.findIndex(e => e.id === event.id)
      ).slice(0, limit);
      
      res.json({ success: true, events: uniqueEvents });
    } catch (error) {
      console.error('Error getting motion events:', error);
      res.status(500).json({ success: false, error: 'Failed to get motion events' });
    }
  });

  // Get motion events for a specific camera
  app.get('/api/motion/:cameraId/events', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const cameraId = req.params.cameraId;
      const eventsDir = EVENTS_DIR;
      
      // Get events from files in the events directory for this camera
      let fileEvents: MotionEvent[] = [];
      try {
        if (fs.existsSync(eventsDir)) {
          const files = fs.readdirSync(eventsDir)
            .filter(file => file.endsWith('.jpg') && file.includes(`_${cameraId}_`))
            .sort((a, b) => {
              const timeA = parseTimestampFromFilename(a);
              const timeB = parseTimestampFromFilename(b);
              return timeB - timeA; // Newest first
            })
            .slice(0, limit);

          fileEvents = files.map(file => {
            const parts = file.split('_');
            let timestamp = new Date().toISOString();
            
            if (parts.length >= 3) {
              const timestampPart = parts[2]?.split('.')[0];
              if (timestampPart) {
                const datePart = timestampPart.substring(0, 10);
                const timePartWithHyphens = timestampPart.substring(11);
                const timeParts = timePartWithHyphens.split('-');
                
                let formattedTime = '';
                if (timeParts.length === 4) {
                  const ms = parseInt(timeParts[3].replace('Z', ''), 10);
                  formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}.${ms}Z`;
                } else if (timeParts.length === 3) {
                  formattedTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}Z`;
                }
                
                const isoTimestamp = `${datePart}T${formattedTime}`;
                const parsedDate = new Date(isoTimestamp);
                if (!isNaN(parsedDate.getTime())) {
                  timestamp = parsedDate.toISOString();
                }
              }
            }
            
            return {
              id: `evt_${file}`,
              cameraId,
              timestamp,
              imagePath: `/events/${file}`,
              confidence: 75,
              duration: 0,
              cameraName: cameraId,
              labels: ['motion'],
              location: cameraId
            };
          });
        }
      } catch (error) {
        console.warn(`Error reading events directory for camera ${cameraId}:`, error);
      }
      
      // Combine and deduplicate - only use file-based events since in-memory events are disabled
      const combinedEvents = [...fileEvents];
      const uniqueEvents = combinedEvents.filter((event, index, self) => 
        index === self.findIndex(e => e.id === event.id)
      ).slice(0, limit);
      
      res.json({ success: true, events: uniqueEvents });
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
  app.get('/api/events/list', (req: Request, res: Response) => {
    try {
      const eventsDir = EVENTS_DIR;
      const files = fs.readdirSync(eventsDir)
        .filter(file => file.endsWith('.jpg'))
        .sort((a, b) => {
          const timeA = parseTimestampFromFilename(a);
          const timeB = parseTimestampFromFilename(b);
          return timeB - timeA;
        });
      res.json({ success: true, files });
    } catch (error) {
      console.error('Error listing events:', error);
      res.status(500).json({ success: false, error: 'Failed to list events' });
    }
  });

  // Serve event images via API
  app.get('/api/events/image/:filename', (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const imagePath = path.join(EVENTS_DIR, filename);
      
      // Security check - ensure filename is valid
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ success: false, error: 'Invalid filename' });
      }
      
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ success: false, error: 'Image not found' });
      }
      
      // Send the file
      res.sendFile(imagePath);
    } catch (error) {
      console.error('Error serving event image:', error);
      res.status(500).json({ success: false, error: 'Failed to serve image' });
    }
  });

  // List snapshots
  app.get('/api/snapshots/list', (req: Request, res: Response) => {
    try {
      const snapshotsDir = path.join(__dirname, '../../public/snapshots');
      const files = fs.readdirSync(snapshotsDir)
        .filter(file => file.endsWith('.jpg'))
        .sort((a, b) => {
          const timeA = parseTimestampFromFilename(a);
          const timeB = parseTimestampFromFilename(b);
          return timeB - timeA;
        });
      res.json({ success: true, files });
    } catch (error) {
      console.error('Error listing snapshots:', error);
      res.status(500).json({ success: false, error: 'Failed to list snapshots' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      activeCameras: streamManager.getAllCameras().filter((c: any) => c.isActive).length
    });
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
    try {
      // Calculate storage usage for events and snapshots
      const eventsDir = EVENTS_DIR;
      const snapshotsDir = path.join(__dirname, '../../public/snapshots');
      
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
      console.error('Error getting storage info:', error);
      res.status(500).json({ success: false, error: 'Failed to get storage info' });
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
      
      // Use objectDetectionService for detection
      const objectDetectionService = getObjectDetectionService();
      const { detections } = await objectDetectionService.detectPersons(cameraId, currentFrame);
      
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
      
      // Use facialRecognitionService for face recognition
      const facialRecognitionService = getFacialRecognitionService();
      const { faces } = await facialRecognitionService.recognizeFaces(cameraId, currentFrame);
      
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
      const objectDetectionService = getGlobalObjectDetectionService();
      const settings = objectDetectionService.getSettings('default');
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
      const objectDetectionService = getGlobalObjectDetectionService();
      const updated = objectDetectionService.updateSettings('default', {
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
      const facialRecognitionService = getGlobalFacialRecognitionService();
      const settings = facialRecognitionService.getSettings();
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
      const facialRecognitionService = getGlobalFacialRecognitionService();
      const updated = facialRecognitionService.updateSettings({
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
  
  // Get known persons
  app.get('/api/detection/face/persons', async (req: Request, res: Response) => {
    try {
      const facialRecognitionService = getGlobalFacialRecognitionService();
      const persons = await facialRecognitionService.getKnownPersons();
      res.json({ success: true, persons });
    } catch (error) {
      console.error('Error getting known persons:', error);
      res.status(500).json({ success: false, error: 'Failed to get known persons' });
    }
  });
  
  // Add a known person
  app.post('/api/detection/face/persons', async (req: Request, res: Response) => {
    try {
      const { name, description, imagePaths } = req.body;
      
      if (!name || !imagePaths || imagePaths.length === 0) {
        return res.status(400).json({ success: false, error: 'Name and at least one image are required' });
      }
      
      const facialRecognitionService = getGlobalFacialRecognitionService();
      const personId = facialRecognitionService.addKnownPerson(name, imagePaths[0]);
      
      res.json({
        success: true,
        personId,
        message: 'Person added successfully'
      });
    } catch (error) {
      console.error('Error adding known person:', error);
      res.status(500).json({ success: false, error: 'Failed to add known person' });
    }
  });
  
  // Get detection events
  app.get('/api/detection/events', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const type = req.query.type as string; // 'person' or 'face'
      
      // For now, return empty array - in real implementation, this would query detection event storage
      res.json({
        success: true,
        events: [],
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
        const objectDetectionService = getGlobalObjectDetectionService();
        const personResult = await objectDetectionService.detectObjects(currentFrame);
        analysisResults.persons = personResult.detections.filter((d) => d.class === 'person');
      }
      
      // Run face detection if enabled
      if (enableFaceDetection) {
        const facialRecognitionService = getGlobalFacialRecognitionService();
        const faceResult = await facialRecognitionService.recognizeFaces(currentFrame);
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
      const eventsDir = EVENTS_DIR;
      let allEvents: any[] = [];

      // Read all event files from filesystem
      if (fs.existsSync(eventsDir)) {
        const files = fs.readdirSync(eventsDir)
          .filter(file => file.endsWith('.jpg'));

        // Parse each file to create event objects
        allEvents = files.map(file => {
          const parts = file.split('_');
          const eventType = parts[0] || 'motion';
          const cameraId = parts[1]?.replace('cam', '') || 'unknown';
          let timestamp = new Date().toISOString();

          // Parse timestamp from filename
          if (parts.length >= 3) {
            const timestampPart = parts[2]?.split('.')[0];
            if (timestampPart) {
              const cleanTimestampPart = timestampPart.replace(/Z$/, '');
              const numericTimestamp = parseInt(cleanTimestampPart, 10);
              const isNumeric = !isNaN(numericTimestamp) && /^\d+$/.test(cleanTimestampPart) && cleanTimestampPart.length > 4;
              if (isNumeric) {
                const parsedDate = new Date(numericTimestamp);
                if (!isNaN(parsedDate.getTime())) {
                  timestamp = parsedDate.toISOString();
                }
              }
            }
          }

          // Determine labels from filename
          let labels = ['motion'];
          if (file.includes('face')) {
            labels = ['face'];
          } else if (file.includes('person')) {
            labels = ['person'];
          }

          return {
            id: `evt_${file}`,
            imageId: file,
            timestamp,
            imagePath: path.join(EVENTS_DIR, file),
            type: eventType,
            confidence: 0.75,
            labels,
            cameraName: cameraId
          };
        });

        // Sort events by timestamp (newest first)
        allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      // Filter by date range
      if (request.startDate) {
        const startDate = new Date(request.startDate);
        allEvents = allEvents.filter((e: any) => new Date(e.timestamp) >= startDate);
      }
      
      if (request.endDate) {
        const endDate = new Date(request.endDate);
        allEvents = allEvents.filter((e: any) => new Date(e.timestamp) <= endDate);
      }
      
      // Apply limit
      if (request.limit) {
        allEvents = allEvents.slice(0, request.limit);
      }
      
      return allEvents;
    } catch (error) {
      console.error('Error getting events for batch:', error);
      return [];
    }
  }

  // Batch detection endpoint - process all events with OpenCV
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

          // Run object detection
          const detectionResult = await openCVClient.detectObjects(imagePath);
          
          // Run face recognition
          const faceResult = await openCVClient.recognizeFaces(imagePath);
          
          results.push({
            eventId: event.id,
            imageId: event.imageId,
            timestamp: event.timestamp,
            detections: detectionResult.detections || [],
            faceDetections: faceResult.faceDetections || [],
            success: detectionResult.success && faceResult.success
          });
          
          // Count detections
          if (detectionResult.detections) {
            detectionResult.detections.forEach((d: any) => {
              if (d.class === 'person') totalPersons++;
              else if (d.class === 'vehicle') totalVehicles++;
              else if (d.class === 'motion') totalMotion++;
            });
          }
          
          if (faceResult.faceDetections) {
            totalFaces += faceResult.faceDetections.length;
          }
          
          if (detectionResult.processingTime) {
            processingTimes.push(detectionResult.processingTime);
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
  app.get('/api/batch/jobs', (req: Request, res: Response) => {
    try {
      const jobs = batchProcessingService.getAllJobs();
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
      
      res.json(events);
    } catch (error: any) {
      console.error('Error getting available events:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Start batch processing
  app.post('/api/batch/start', async (req: Request, res: Response) => {
    try {
      const options = req.body;
      
      const jobId = await batchProcessingService.startBatchProcessing(options);
      
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
}