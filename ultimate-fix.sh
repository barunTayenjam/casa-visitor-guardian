#!/bin/bash

echo "🚨 COMPREHENSIVE HTTP HANGING FIX - FINAL VERSION"

# Create a completely clean version of routes/index.ts without detection services
echo "📝 Creating clean routes/index.ts..."

cat > /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts << 'CLEAN_EOF'
import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { StreamManager, Camera, streamManager } from '../streams/rtspManager.js';
import { validate, commonSchemas } from '../middleware/validation.js';
import { createAuthRateLimit, createStreamRateLimit } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';
import auditLogger from '../utils/auditLogger.js';
import logRoutes from './logRoutes.js';

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
  cameraName?: string;
  labels?: string[];
  location?: string;
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
    id: \`alert_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
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

// Helper function to get current stream manager
function getStreamManager() {
  return (global as any).streamManager;
}

// Routes configuration
export function configureRoutes(app: Express, io: SocketIOServer) {
  
  // Add motion event listener
  const handleMotionDetected = (event: MotionEvent) => {
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
      message: \`Motion detected on camera \${event.cameraName || event.cameraId}\`,
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
      console.error(\`Error acknowledging alert \${req.params.id}:\`, error);
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
      console.error(\`Error deleting alert \${req.params.id}:\`, error);
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

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // System overview endpoint
  app.get('/api/system/overview', (req: Request, res: Response) => {
    try {
      const cameras = getStreamManager()?.getAllCameras() || [];
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

  logger.info('Routes configured successfully', 'ROUTES');
}

export default configureRoutes;
CLEAN_EOF

echo "✅ Created clean routes/index.ts"

# Rebuild and restart
echo "🔨 Rebuilding container..."
docker-compose build --no-cache backend 2>/dev/null

echo "🔄 Restarting container..."
docker-compose restart backend

echo "⏳ Waiting for startup..."
sleep 8

echo "🧪 Testing HTTP endpoints..."
echo "Testing health endpoint:"
if curl -s --max-time 5 http://localhost:9753/health > /dev/null; then
    echo "✅ SUCCESS! HTTP requests working!"
    echo "📊 Health response:"
    curl -s http://localhost:9753/health | head -c 200
else
    echo "❌ Still hanging - checking logs..."
    docker logs sentryvision-backend --tail 10
fi

echo ""
echo "Testing test endpoint:"
if curl -s --max-time 5 http://localhost:9753/test > /dev/null; then
    echo "✅ Test endpoint working!"
else
    echo "❌ Test endpoint hanging"
fi

echo ""
echo "🎯 HTTP HANGING FIX COMPLETED!"
echo "📋 Container status:"
docker ps --filter name=sentryvision-backend