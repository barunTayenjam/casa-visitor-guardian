import { Express, Request, Response } from 'express';
import { validate, commonSchemas } from '../middleware/validation.js';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import type { Camera, CameraConfig } from '../config/index.js';

// Validate cameraId parameter
function validateCameraIdParam(cameraId: string, res: Response): boolean {
  const CAMERA_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
  if (!cameraId || !CAMERA_ID_PATTERN.test(cameraId) || cameraId.length > 100) {
    res.status(400).json({ success: false, error: 'Invalid camera ID format' });
    return false;
  }
  return true;
}

export function configureCameraRoutes(app: Express) {
  // Get list of all cameras
  app.get('/api/cameras', optionalAuth, (req: Request, res: Response) => {
    try {
      logger.apiRequest('GET', '/api/cameras', req.ip || 'unknown', req.get('User-Agent'));

      const currentStreamManager = serviceRegistry.getStreamManager();

      if (!currentStreamManager) {
        logger.error('streamManager is not initialized', 'API');
        return res.json({
          success: true,
          cameras: [],
          timestamp: new Date().toISOString(),
          message: 'Camera system not initialized - no cameras configured'
        });
      }

      const cameras = currentStreamManager.getAllCameras();
      logger.info('Fetched cameras from stream manager', 'API', { cameraCount: cameras.length });

      const optimizedCameras = cameras.map((camera: Camera) => {
        let status = 'offline';
        if (camera.isActive) {
          status = 'online';
        } else if (camera.retryCount && camera.retryCount > 0) {
          status = 'warning';
        }

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
  app.get('/api/cameras/:id', optionalAuth, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
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
  app.post('/api/cameras', requireUser, validate(commonSchemas.createCamera), (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const { name, rtspUrl, username, password, frameRate, resolution, nightMode } = req.body;

      const cameraId = streamManager.addCamera({
        id: '',
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
        detect: { width: 640, height: 360, fps: 5 },
        record: { enabled: true },
        nightMode: nightMode || false
      });

      res.json({ success: true, cameraId });
    } catch (error) {
      console.error('Error adding camera:', error);
      res.status(500).json({ success: false, error: 'Failed to add camera' });
    }
  });

  // Update camera settings
  app.put('/api/cameras/:id', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const { name, nightMode } = req.body;
      const updates: Partial<CameraConfig> = {};
      if (name !== undefined) updates.name = name;
      if (nightMode !== undefined) updates.nightMode = nightMode;

      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found', cameraId: req.params.id });
      }

      const updated = streamManager.updateCamera(req.params.id, updates);
      if (!updated) {
        return res.status(500).json({ success: false, error: 'Failed to update camera', cameraId: req.params.id });
      }

      const updatedCamera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      res.json({
        success: true,
        camera: { ...updatedCamera, status: updatedCamera?.isActive ? 'online' : 'offline' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error updating camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update camera', details: error instanceof Error ? error.message : 'Unknown error', cameraId: req.params.id });
    }
  });

  // Delete a camera
  app.delete('/api/cameras/:id', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
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

  // Start test streaming
  app.post('/api/cameras/:id/stream/start-test', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found', cameraId: req.params.id });
      }

      streamManager.stopStream(req.params.id);
      streamManager.startTestStream(req.params.id, 'detect');
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
      res.status(500).json({ success: false, error: 'Failed to start test stream', details: error instanceof Error ? error.message : 'Unknown error', cameraId: req.params.id });
    }
  });

  // Start streaming
  app.post('/api/cameras/:id/stream/start', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found', cameraId: req.params.id });
      }
      if (camera.isActive) {
        return res.status(400).json({ success: false, error: 'Camera is already streaming', status: 'streaming', cameraId: req.params.id });
      }

      camera.streams.forEach((_value: any, role: 'detect' | 'record' | 'live') => {
        streamManager.startStream(req.params.id, role);
      });

      res.json({ success: true, status: 'streaming', cameraId: req.params.id, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error(`Error starting stream for camera ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Failed to start stream', details: error instanceof Error ? error.message : 'Unknown error', cameraId: req.params.id });
    }
  });

  // Stop streaming
  app.post('/api/cameras/:id/stream/stop', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
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

  // Take a snapshot
  app.post('/api/cameras/:id/snapshot', requireUser, async (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
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

  // Toggle night mode
  app.post('/api/cameras/:id/night-mode', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
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

  // Zone configuration endpoints

  // Get zones for a camera
  app.get('/api/cameras/:cameraId/zones', optionalAuth, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }
      res.json({ success: true, cameraId: req.params.cameraId, zones: camera.config.zones || [] });
    } catch (error) {
      console.error(`Error getting zones for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get zones' });
    }
  });

  // Add a zone to a camera
  app.post('/api/cameras/:cameraId/zones', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
      }

      const { id, name, coordinates, objects, inertia, loiteringTime } = req.body;
      if (!id || !name || !coordinates || !Array.isArray(coordinates)) {
        return res.status(400).json({ success: false, error: 'Zone must have id, name, and coordinates (array of [x,y] normalized 0-1)' });
      }

      const validCoords = coordinates.every((coord: any) =>
        Array.isArray(coord) && coord.length === 2 && coord[0] >= 0 && coord[0] <= 1 && coord[1] >= 0 && coord[1] <= 1
      );
      if (!validCoords) {
        return res.status(400).json({ success: false, error: 'Coordinates must be arrays of [x,y] with values between 0 and 1' });
      }

      const newZone = { id, name, coordinates, objects: objects || ['person'], inertia: inertia || 3, loiteringTime: loiteringTime || 0 };
      if (!camera.config.zones) camera.config.zones = [];

      const existingIndex = camera.config.zones.findIndex((z: any) => z.id === id);
      if (existingIndex >= 0) {
        camera.config.zones[existingIndex] = newZone;
      } else {
        camera.config.zones.push(newZone);
      }

      res.json({ success: true, message: existingIndex >= 0 ? 'Zone updated' : 'Zone added', zone: newZone });
    } catch (error) {
      console.error(`Error adding zone for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to add zone' });
    }
  });

  // Update a zone
  app.put('/api/cameras/:cameraId/zones/:zoneId', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });
      if (!camera.config.zones) return res.status(404).json({ success: false, error: 'No zones configured' });

      const zoneIndex = camera.config.zones.findIndex((z: any) => z.id === req.params.zoneId);
      if (zoneIndex < 0) return res.status(404).json({ success: false, error: 'Zone not found' });

      const { name, coordinates, objects, inertia, loiteringTime } = req.body;
      if (name) camera.config.zones[zoneIndex].name = name;
      if (coordinates) camera.config.zones[zoneIndex].coordinates = coordinates;
      if (objects) camera.config.zones[zoneIndex].objects = objects;
      if (inertia !== undefined) camera.config.zones[zoneIndex].inertia = inertia;
      if (loiteringTime !== undefined) camera.config.zones[zoneIndex].loiteringTime = loiteringTime;

      res.json({ success: true, message: 'Zone updated', zone: camera.config.zones[zoneIndex] });
    } catch (error) {
      console.error(`Error updating zone for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update zone' });
    }
  });

  // Delete a zone
  app.delete('/api/cameras/:cameraId/zones/:zoneId', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });
      if (!camera.config.zones) return res.status(404).json({ success: false, error: 'No zones configured' });

      const zoneIndex = camera.config.zones.findIndex((z: any) => z.id === req.params.zoneId);
      if (zoneIndex < 0) return res.status(404).json({ success: false, error: 'Zone not found' });

      camera.config.zones.splice(zoneIndex, 1);
      res.json({ success: true, message: 'Zone deleted' });
    } catch (error) {
      console.error(`Error deleting zone for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to delete zone' });
    }
  });

  // Object filters endpoints

  // Get object filters for a camera
  app.get('/api/cameras/:cameraId/filters', optionalAuth, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });
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
  app.put('/api/cameras/:cameraId/filters/track', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      const { track } = req.body;
      if (!Array.isArray(track)) return res.status(400).json({ success: false, error: 'Track must be an array of object labels' });

      if (!camera.config.objects) camera.config.objects = { track: [], filters: {} };
      camera.config.objects.track = track;
      res.json({ success: true, message: 'Track list updated', track });
    } catch (error) {
      console.error(`Error updating track list for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update track list' });
    }
  });

  // Update object filter for a specific label
  app.put('/api/cameras/:cameraId/filters/:label', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      const { minArea, maxArea, minRatio, maxRatio, minScore, threshold, mask } = req.body;
      if (!camera.config.objects) camera.config.objects = { track: [], filters: {} };
      if (!camera.config.objects.filters) camera.config.objects.filters = {};

      camera.config.objects.filters[req.params.label] = {
        minArea: minArea || 0,
        maxArea: maxArea || 24000000,
        minRatio: minRatio || 0,
        maxRatio: maxRatio || 24000000,
        minScore: minScore || 0.5,
        threshold: threshold || 0.7,
        mask: mask || ''
      };
      res.json({ success: true, message: `Filter for ${req.params.label} updated`, filter: camera.config.objects.filters[req.params.label] });
    } catch (error) {
      console.error(`Error updating filter for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update filter' });
    }
  });

  // Delete object filter
  app.delete('/api/cameras/:cameraId/filters/:label', requireUser, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      if (camera.config.objects?.filters?.[req.params.label]) {
        delete camera.config.objects.filters[req.params.label];
      }
      res.json({ success: true, message: `Filter for ${req.params.label} deleted` });
    } catch (error) {
      console.error(`Error deleting filter for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to delete filter' });
    }
  });

  // Motion detection settings endpoints

  // Get motion detection settings
  app.get('/api/motion/:cameraId/settings', optionalAuth, (req: Request, res: Response) => {
    try {
      const motionDetector = serviceRegistry.getMotionDetector();
      const settings = motionDetector.getSettings(req.params.cameraId);
      if (!settings) return res.status(404).json({ success: false, error: 'Settings not found' });
      res.json({ success: true, settings });
    } catch (error) {
      console.error(`Error getting motion settings for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get motion settings' });
    }
  });

  // Update motion detection settings
  app.put('/api/motion/:cameraId/settings', requireUser, (req: Request, res: Response) => {
    try {
      const { enabled, sensitivity, cooldownPeriod } = req.body;
      const motionDetector = serviceRegistry.getMotionDetector();
      const updated = motionDetector.updateSettings(req.params.cameraId, { enabled, sensitivity, cooldownPeriod });
      if (!updated) return res.status(404).json({ success: false, error: 'Camera not found' });
      res.json({ success: true });
    } catch (error) {
      console.error(`Error updating motion settings for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to update motion settings' });
    }
  });
}
