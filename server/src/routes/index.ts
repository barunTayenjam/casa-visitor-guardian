import { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { StreamManager } from '../streams/rtspManager.js';

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
}

// Store recent motion events in memory
const recentEvents: MotionEvent[] = [];

// Routes configuration
export function configureRoutes(app: Express, io: SocketIOServer) {
  // Get instances from global scope
  const streamManager = (global as any).streamManager as StreamManager;
  const motionDetector = (global as any).motionDetector;
  
  // Add motion event listener
  io.on('motionDetected', (event: MotionEvent) => {
    // Add to recent events
    recentEvents.unshift(event);
    
    // Keep only last 100 events
    if (recentEvents.length > 100) {
      recentEvents.pop();
    }
  });

  // API endpoints
  
  // Get list of all cameras
  app.get('/api/cameras', (req: Request, res: Response) => {
    try {
      const cameras = streamManager.getAllCameras();
      res.json({ success: true, cameras });
    } catch (error) {
      console.error('Error getting cameras:', error);
      res.status(500).json({ success: false, error: 'Failed to get cameras' });
    }
  });

  // Get details for a specific camera
  app.get('/api/cameras/:id', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getAllCameras().find(c => c.id === req.params.id);
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
      const { name, rtspUrl, username, password, frameRate, resolution, nightMode } = req.body;
      const updated = streamManager.updateCamera(req.params.id, {
        name,
        rtspUrl,
        username,
        password,
        frameRate,
        resolution,
        nightMode
      });
      
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(`Error updating camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update camera' });
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
      const started = streamManager.startStream(req.params.id);
      if (!started) {
        return res.status(500).json({ success: false, error: 'Failed to start stream' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`Error starting stream for camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start stream' });
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

  // Get recent motion events
  app.get('/api/motion/events', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const events = recentEvents.slice(0, limit);
      res.json({ success: true, events });
    } catch (error) {
      console.error('Error getting motion events:', error);
      res.status(500).json({ success: false, error: 'Failed to get motion events' });
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

  // Trigger a simulated motion event (for testing)
  app.post('/api/motion/:cameraId/simulate', (req: Request, res: Response) => {
    try {
      const camera = streamManager.getAllCameras().find(c => c.id === req.params.cameraId);
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

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      activeCameras: streamManager.getAllCameras().filter(c => c.isActive).length
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
        onlineCameras: cameras.filter(c => c.isActive).length,
        totalEvents: recentEvents.length,
        todayEvents: recentEvents.filter(e => {
          const eventDate = new Date(e.timestamp);
          const today = new Date();
          return eventDate.getDate() === today.getDate() &&
                 eventDate.getMonth() === today.getMonth() &&
                 eventDate.getFullYear() === today.getFullYear();
        }).length,
        storageUsed: 0, // This would need a real implementation
        storageTotal: 0 // This would need a real implementation
      };
      
      res.json({ success: true, overview });
    } catch (error) {
      console.error('Error getting system overview:', error);
      res.status(500).json({ success: false, error: 'Failed to get system overview' });
    }
  });
  
  console.log('API routes configured');
}
