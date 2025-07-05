import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { StreamManager, Camera } from '../streams/rtspManager.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const streamManager = global.streamManager;
  const motionDetector = global.motionDetector;
  
  // Add motion event listener
  const handleMotionDetected = (event: MotionEvent) => {
    console.log('Motion event received in routes:', event);
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

  // Get list of all cameras
  app.get('/api/cameras', (req: Request, res: Response) => {
    try {
      if (!streamManager) {
        console.error('streamManager is not initialized');
        return res.status(503).json({ 
          success: false, 
          error: 'Camera system not initialized',
          status: 'unavailable'
        });
      }

      const cameras = streamManager.getAllCameras();
      console.log('Fetched cameras:', cameras);
      // Add additional camera state information
      const enrichedCameras = cameras.map((camera: Camera) => {
        let status = 'offline';
        if (camera.isActive) {
          status = 'online';
        } else if (camera.retryCount && camera.retryCount > 0) {
          status = 'warning'; // Camera is trying to reconnect
        }
        
        return {
          ...camera,
          status,
          lastError: camera.lastError || undefined,
          retryCount: camera.retryCount || 0,
          // Add more debugging info
          connectionAttempts: camera.retryCount || 0,
          hasProcess: !!camera.process,
          lastFrameTime: camera.lastFrame ? 'Available' : 'None'
        };
      });
      console.log('Enriched cameras:', enrichedCameras);

      res.json({ 
        success: true, 
        cameras: enrichedCameras,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting cameras:', error);
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
  app.post('/api/cameras', (req: Request, res: Response) => {
    try {
      const { name, rtspUrl, username, password, frameRate, resolution } = req.body;
      
      // Validation
      if (!name || !rtspUrl) {
        return res.status(400).json({ success: false, error: 'Name and RTSP URL are required' });
      }
      
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

      const eventsDir = path.join(__dirname, '../../public/events');
      const allFiles = fs.readdirSync(eventsDir)
        .filter(file => file.endsWith('.jpg'))
        .map(file => {
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
        .sort((a: MotionEvent, b: MotionEvent) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      let filteredEvents = allFiles;

      if (cameraIdFilter && cameraIdFilter !== 'all') {
        filteredEvents = filteredEvents.filter(event => event.cameraId === cameraIdFilter);
      }

      if (searchQuery) {
        const lowerCaseSearchQuery = searchQuery.toLowerCase();
        filteredEvents = filteredEvents.filter(event =>
          event.cameraId.toLowerCase().includes(lowerCaseSearchQuery) ||
          event.labels.some(label => label.toLowerCase().includes(lowerCaseSearchQuery)) ||
          event.location?.toLowerCase().includes(lowerCaseSearchQuery)
        );
      }

      if (startDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) >= startDate);
      }

      if (endDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) <= endDate);
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

  // Get motion events for a specific camera
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

  

  

  

  

  console.log('API routes configured');
}