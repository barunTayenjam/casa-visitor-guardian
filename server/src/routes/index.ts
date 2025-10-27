import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { StreamManager, Camera } from '../streams/rtspManager.js';
import { validate, commonSchemas } from '../middleware/validation.js';
import { createAuthRateLimit, createStreamRateLimit } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';
import { auditLogger } from '../utils/auditLogger.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  return 0; // Return 0 or handle error appropriately
};

// Routes configuration
export function configureRoutes(app: Express, io: SocketIOServer) {
  // Get instances from global scope
  const streamManager = (global as any).streamManager;
  const motionDetector = (global as any).motionDetector;
  const objectDetectionService = (global as any).objectDetectionService;
  const facialRecognitionService = (global as any).facialRecognitionService;
  
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
      const cameras = streamManager.getAllCameras();
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
      
      if (!streamManager) {
        logger.error('streamManager is not initialized', 'API');
        return res.status(503).json({ 
          success: false, 
          error: 'Camera system not initialized',
          status: 'unavailable'
        });
      }

      const cameras = streamManager.getAllCameras();
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

      logger.apiResponse('GET', '/api/cameras', 200, undefined, { 
        cameraCount: optimizedCameras.length,
        responseSize: JSON.stringify(optimizedCameras).length 
      });

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
        nightMode: false
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
      
      if (process && process.stdout) {
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
        const generateTestMjpegFrame = (cameraId: string) => {
          try {
            const { generateTestJpegFrame } = require('../utils/testImageGenerator.js');
            return generateTestJpegFrame(cameraId);
          } catch (err) {
            console.error(`Error importing test frame generator:`, err);
            // Return a simple buffer
            return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAErCXcZAAAADklEQVR4AewAfQXgcAAAvBE4dLToAAAAAAAD8/UEAAQAAAgwECkAAMAAsCAAALBhAAAAAAAABJRU5ErkJggg==', 'base64');
          }
        };
        
        let interval: NodeJS.Timeout | null = null;
        
        let isActive = true;
        
        const sendFrame = () => {
          if (!isActive) return;
          
          try {
            const frame = generateTestMjpegFrame(cameraId);
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

  // Get historical motion events with pagination and filtering
  app.get('/api/events/history', (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const cameraIdFilter = req.query.cameraId as string;
      const searchQuery = req.query.searchQuery as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;
      const sortBy = req.query.sortBy as string || 'newest';

      console.log('API Request:', {
        page,
        pageSize,
        cameraIdFilter,
        searchQuery,
        startDate,
        endDate,
        sortBy
      });

      const eventsDir = path.join(__dirname, '../../public/events');
      const allFiles = fs.readdirSync(eventsDir)
        .filter(file => file.endsWith('.jpg'))
        .map(file => {
          const parts = file.split('_');
          const cameraId = parts[1] || 'unknown';
          let timestamp = new Date().toISOString();
          
          // Get file modification time as a reliable fallback
          const filePath = path.join(eventsDir, file);
          const fileStats = fs.statSync(filePath);
          const fileModTime = fileStats.mtime.toISOString();
          
          if (parts.length >= 3) {
            const timestampPart = parts[2]?.split('.')[0]; // e.g., "1760618163997" (Unix timestamp in ms) or "2025-07-05T16-28-17-799Z"
            if (timestampPart) {
              let parsed = false;
              
              // Check if it's a Unix timestamp (length 13 digits for ms, 10 digits for seconds)
              const timestampNum = parseInt(timestampPart);
              if (!isNaN(timestampNum) && /^\d{10,13}$/.test(timestampPart)) {
                if (timestampPart.length === 13) {
                  // Unix timestamp in milliseconds
                  timestamp = new Date(timestampNum).toISOString();
                  parsed = true;
                } else if (timestampPart.length === 10) {
                  // Unix timestamp in seconds
                  timestamp = new Date(timestampNum * 1000).toISOString();
                  parsed = true;
                }
              }
              
              // Check if it's an ISO-like format (e.g., "2025-07-05T16-28-17-799Z")
              if (!parsed && timestampPart.includes('T') && timestampPart.includes('-')) {
                try {
                  // Convert the filename format to ISO format
                  // Replace '-' between time components with ':' and handle milliseconds
                  let isoStr = timestampPart;
                  // Fix milliseconds part - convert "-799Z" to ".799Z"
                  isoStr = isoStr.replace(/-(\d{3})Z/, '.$1Z');
                  // Fix the time separators (HH-mm-ss -> HH:mm:ss)
                  isoStr = isoStr.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
                  
                  const dateObj = new Date(isoStr);
                  if (!isNaN(dateObj.getTime())) {
                    timestamp = dateObj.toISOString();
                    parsed = true;
                  }
                } catch (e) {
                  console.log(`Failed to parse ISO-like timestamp: ${timestampPart}`);
                }
              }
              
              if (!parsed) {
                // If parsing fails, use file modification time
                timestamp = fileModTime;
                console.log(`Using file modification time for ${file}: ${fileModTime}`);
              }
            } else {
              // If no timestamp part, use file modification time
              timestamp = fileModTime;
            }
          } else {
            // If filename format is unexpected, use file modification time
            timestamp = fileModTime;
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
        });

      let filteredEvents = allFiles;

      console.log('Total files before filtering:', allFiles.length);

      if (cameraIdFilter && cameraIdFilter !== 'all') {
        filteredEvents = filteredEvents.filter(event => event.cameraId === cameraIdFilter);
        console.log('After camera filter:', filteredEvents.length);
      }

      if (searchQuery) {
        const lowerCaseSearchQuery = searchQuery.toLowerCase();
        filteredEvents = filteredEvents.filter(event =>
          event.cameraId.toLowerCase().includes(lowerCaseSearchQuery) ||
          event.labels.some(label => label.toLowerCase().includes(lowerCaseSearchQuery)) ||
          event.location?.toLowerCase().includes(lowerCaseSearchQuery)
        );
        console.log('After search filter:', filteredEvents.length);
      }

      if (startDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) >= startDate);
        console.log('After start date filter:', filteredEvents.length, 'from:', startDate);
      }

      if (endDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) <= endDate);
        console.log('After end date filter:', filteredEvents.length, 'to:', endDate);
      }

      // Apply sorting AFTER filtering to get correct order within filtered results
      filteredEvents = filteredEvents.sort((a: MotionEvent, b: MotionEvent) => {
        switch (sortBy) {
          case 'oldest':
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          case 'confidence':
            return b.confidence - a.confidence;
          case 'newest':
          default:
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }
      });

      // Debug: Log sorting results
      console.log(`=== SORTING DEBUG (sortBy: ${sortBy}) ===`);
      console.log('Total filtered events:', filteredEvents.length);
      if (filteredEvents.length > 0) {
        console.log('First 3 events after sorting:');
        filteredEvents.slice(0, 3).forEach((event, index) => {
          console.log(`  ${index + 1}. ${event.cameraId} | ${event.timestamp} | ${event.imagePath}`);
        });
      }
      console.log('=== END SORTING DEBUG ===');

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

      const eventsDir = path.join(__dirname, '../../public/events');
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
      const eventsDir = path.join(__dirname, '../../public/events');
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
      
      // Filter in-memory events to only include those where the image file actually exists
      const memoryEvents = recentEvents
        .filter(event => {
          if (!event.imagePath) return false;
          const filename = event.imagePath.replace('/events/', '');
          const filepath = path.join(eventsDir, filename);
          return fs.existsSync(filepath);
        })
        .slice(0, limit);
      
      // Combine and deduplicate
      const combinedEvents = [...allEvents, ...memoryEvents];
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
      const eventsDir = path.join(__dirname, '../../public/events');
      
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
      
      // Filter in-memory events to only include those where the image file actually exists
      const memoryEvents = recentEvents
        .filter(event => {
          if (event.cameraId !== cameraId) return false;
          if (!event.imagePath) return false;
          const filename = event.imagePath.replace('/events/', '');
          const filepath = path.join(eventsDir, filename);
          return fs.existsSync(filepath);
        })
        .slice(0, limit);
      
      // Combine and deduplicate
      const combinedEvents = [...fileEvents, ...memoryEvents];
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
      const eventsDir = path.join(__dirname, '../../public/events');
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
      const cameras = streamManager.getAllCameras();
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
      const eventsDir = path.join(__dirname, '../../public/events');
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
      const cameras = streamManager.getAllCameras();
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

  

  

  

  

  // Health check endpoint for Docker
  app.get('/api/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
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
      
      // Run person detection
      const detectionResult = await objectDetectionService.detectObjects(cameraId, currentFrame);
      
      // Process detection results
      const persons = detectionResult.detections.filter((d: any) => d.class === 'person');
      
      if (persons.length > 0) {
        // Emit person detection event
        io.emit('personDetected', {
          cameraId,
          timestamp: new Date().toISOString(),
          persons: persons.map((p: any) => ({
            confidence: p.confidence,
            boundingBox: p.boundingBox,
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
        detections: detectionResult.detections,
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
      
      // Run facial detection
      const faceResult = await facialRecognitionService.recognizeFaces(cameraId, currentFrame);
      
      if (faceResult.faces.length > 0) {
        // Emit face detection event
        io.emit('faceDetected', {
          cameraId,
          timestamp: new Date().toISOString(),
          faces: faceResult.faces.map((f: any) => ({
            confidence: f.confidence,
            boundingBox: f.boundingBox,
            personId: f.personId,
            personName: f.personName,
            isKnown: f.isKnown,
            timestamp: new Date().toISOString()
          })),
          imagePath: faceResult.detectionImagePath
        });
        
        // Add alert for face detection
        const unknownFaces = faceResult.faces.filter((f: any) => !f.isKnown);
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
        faces: faceResult.faces.length,
        knownFaces: faceResult.faces.filter((f: any) => f.isKnown).length,
        unknownFaces: faceResult.faces.filter((f: any) => !f.isKnown).length,
        detections: faceResult.faces,
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
      const settings = objectDetectionService.getSettings('default');
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error getting person detection settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get person detection settings' });
    }
  });
  
  // Update person detection settings
  app.put('/api/detection/person/settings', (req: Request, res: Response) => {
    try {
      const { minConfidence, maxDetections, targetClasses } = req.body;
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
      const settings = facialRecognitionService.getSettings('default');
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
      const updated = facialRecognitionService.updateSettings('default', {
        recognitionThreshold: recognitionThreshold || 0.6,
        minFaceSize: minFaceSize || 48,
        livenessDetection: livenessDetection || false
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
      
      const personId = await facialRecognitionService.addKnownPerson(name, imagePaths, description);
      
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
        const personResult = await objectDetectionService.detectObjects(currentFrame, {
          detectClasses: ['person'],
          confidenceThreshold: 0.5
        });
        analysisResults.persons = personResult.detections.filter((d: any) => d.class === 'person');
      }
      
      // Run face detection if enabled
      if (enableFaceDetection) {
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
  
  // API routes config log disabled - console.log('API routes configured');
}