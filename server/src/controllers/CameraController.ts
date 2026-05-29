import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { logger } from '../utils/logger.js';
import type { Camera } from '../streams/rtspManager.js';
import type { CameraConfig } from '../config/index.js';

export class CameraController extends BaseController {
  listAll(req: Request, res: Response): void {
    try {
      logger.apiRequest('GET', '/api/cameras', req.ip || 'unknown', req.get('User-Agent'));

      const currentStreamManager = serviceRegistry.getStreamManager();

      if (!currentStreamManager) {
        logger.error('streamManager is not initialized', 'API');
        res.json({
          success: true,
          cameras: [],
          timestamp: new Date().toISOString(),
          message: 'Camera system not initialized - no cameras configured'
        });
        return;
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
  }

  getById(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        this.notFound(res, 'Camera not found');
        return;
      }
      this.ok(res, { camera: camera as unknown as Record<string, unknown> });
    } catch (error) {
      this.serverError(res, error, 'getCamera');
    }
  }

  create(req: Request, res: Response): void {
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
      } as CameraConfig);

      this.created(res, { cameraId });
    } catch (error) {
      this.serverError(res, error, 'createCamera');
    }
  }

  update(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const { name, nightMode } = req.body;
      const updates: Partial<CameraConfig> = {};
      if (name !== undefined) updates.name = name;
      if (nightMode !== undefined) updates.nightMode = nightMode;

      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        this.notFound(res, 'Camera not found');
        return;
      }

      const updated = streamManager.updateCamera(req.params.id, updates);
      if (!updated) {
        this.serverError(res, 'Failed to update camera');
        return;
      }

      const updatedCamera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      this.ok(res, {
        camera: { ...updatedCamera, status: updatedCamera?.isActive ? 'online' : 'offline' },
        timestamp: new Date().toISOString()
      } as any);
    } catch (error) {
      this.serverError(res, error, 'updateCamera');
    }
  }

  remove(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const removed = streamManager.removeCamera(req.params.id);
      if (!removed) {
        this.notFound(res, 'Camera not found');
        return;
      }
      this.ok(res, {});
    } catch (error) {
      this.serverError(res, error, 'removeCamera');
    }
  }

  startTestStream(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        this.notFound(res, 'Camera not found');
        return;
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
      this.serverError(res, error, 'startTestStream');
    }
  }

  startStream(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === req.params.id);
      if (!camera) {
        this.notFound(res, 'Camera not found');
        return;
      }
      if (camera.isActive && camera.mainProcess) {
        res.status(400).json({ success: false, error: 'Camera is already streaming', status: 'streaming', cameraId: req.params.id });
        return;
      }

      camera.streams.forEach((_value: any, role: 'detect' | 'record' | 'live') => {
        streamManager.startStream(req.params.id, role);
      });

      res.json({ success: true, status: 'streaming', cameraId: req.params.id, timestamp: new Date().toISOString() });
    } catch (error) {
      this.serverError(res, error, 'startStream');
    }
  }

  stopStream(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const stopped = streamManager.stopStream(req.params.id);
      if (!stopped) {
        this.serverError(res, 'Failed to stop stream');
        return;
      }
      this.ok(res, {});
    } catch (error) {
      this.serverError(res, error, 'stopStream');
    }
  }

  takeSnapshot(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const { resolution } = req.body || {};
      streamManager.takeSnapshot(req.params.id, resolution).then((snapshotPath: string | null) => {
        if (!snapshotPath) {
          this.serverError(res, 'Failed to take snapshot');
          return;
        }
        this.ok(res, { snapshotPath });
      }).catch((error: unknown) => {
        this.serverError(res, error, 'takeSnapshot');
      });
    } catch (error) {
      this.serverError(res, error, 'takeSnapshot');
    }
  }

  toggleNightMode(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        this.badRequest(res, 'Enabled parameter must be a boolean');
        return;
      }
      const updated = streamManager.toggleNightMode(req.params.id, enabled);
      if (!updated) {
        this.notFound(res, 'Camera not found');
        return;
      }
      this.ok(res, {});
    } catch (error) {
      this.serverError(res, error, 'toggleNightMode');
    }
  }

  getZones(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        this.notFound(res, 'Camera not found');
        return;
      }
      this.ok(res, { cameraId: req.params.cameraId, zones: camera.config.zones || [] });
    } catch (error) {
      this.serverError(res, error, 'getZones');
    }
  }

  addZone(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) {
        this.notFound(res, 'Camera not found');
        return;
      }

      const { id, name, coordinates, objects, inertia, loiteringTime } = req.body;
      if (!id || !name || !coordinates || !Array.isArray(coordinates)) {
        this.badRequest(res, 'Zone must have id, name, and coordinates (array of [x,y] normalized 0-1)');
        return;
      }

      const validCoords = coordinates.every((coord: any) =>
        Array.isArray(coord) && coord.length === 2 && coord[0] >= 0 && coord[0] <= 1 && coord[1] >= 0 && coord[1] <= 1
      );
      if (!validCoords) {
        this.badRequest(res, 'Coordinates must be arrays of [x,y] with values between 0 and 1');
        return;
      }

      const newZone = { id, name, coordinates, objects: objects || ['person'], inertia: inertia || 3, loiteringTime: loiteringTime || 0 };
      if (!camera.config.zones) camera.config.zones = [];

      const existingIndex = camera.config.zones.findIndex((z: any) => z.id === id);
      if (existingIndex >= 0) {
        camera.config.zones[existingIndex] = newZone;
      } else {
        camera.config.zones.push(newZone);
      }

      this.ok(res, { message: existingIndex >= 0 ? 'Zone updated' : 'Zone added', zone: newZone });
    } catch (error) {
      this.serverError(res, error, 'addZone');
    }
  }

  updateZone(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) { this.notFound(res, 'Camera not found'); return; }
      if (!camera.config.zones) { this.notFound(res, 'No zones configured'); return; }

      const zoneIndex = camera.config.zones.findIndex((z: any) => z.id === req.params.zoneId);
      if (zoneIndex < 0) { this.notFound(res, 'Zone not found'); return; }

      const { name, coordinates, objects, inertia, loiteringTime } = req.body;
      if (name) camera.config.zones[zoneIndex].name = name;
      if (coordinates) camera.config.zones[zoneIndex].coordinates = coordinates;
      if (objects) camera.config.zones[zoneIndex].objects = objects;
      if (inertia !== undefined) camera.config.zones[zoneIndex].inertia = inertia;
      if (loiteringTime !== undefined) camera.config.zones[zoneIndex].loiteringTime = loiteringTime;

      this.ok(res, { message: 'Zone updated', zone: camera.config.zones[zoneIndex] });
    } catch (error) {
      this.serverError(res, error, 'updateZone');
    }
  }

  deleteZone(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) { this.notFound(res, 'Camera not found'); return; }
      if (!camera.config.zones) { this.notFound(res, 'No zones configured'); return; }

      const zoneIndex = camera.config.zones.findIndex((z: any) => z.id === req.params.zoneId);
      if (zoneIndex < 0) { this.notFound(res, 'Zone not found'); return; }

      camera.config.zones.splice(zoneIndex, 1);
      this.ok(res, { message: 'Zone deleted' });
    } catch (error) {
      this.serverError(res, error, 'deleteZone');
    }
  }

  getFilters(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) { this.notFound(res, 'Camera not found'); return; }
      this.ok(res, {
        cameraId: req.params.cameraId,
        track: camera.config.objects?.track || [],
        filters: camera.config.objects?.filters || {}
      });
    } catch (error) {
      this.serverError(res, error, 'getFilters');
    }
  }

  updateTrackList(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) { this.notFound(res, 'Camera not found'); return; }

      const { track } = req.body;
      if (!Array.isArray(track)) { this.badRequest(res, 'Track must be an array of object labels'); return; }

      if (!camera.config.objects) camera.config.objects = { track: [], filters: {} };
      camera.config.objects.track = track;
      this.ok(res, { message: 'Track list updated', track });
    } catch (error) {
      this.serverError(res, error, 'updateTrackList');
    }
  }

  updateFilter(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) { this.notFound(res, 'Camera not found'); return; }

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
      this.ok(res, { message: `Filter for ${req.params.label} updated`, filter: camera.config.objects.filters[req.params.label] });
    } catch (error) {
      this.serverError(res, error, 'updateFilter');
    }
  }

  deleteFilter(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(req.params.cameraId);
      if (!camera) { this.notFound(res, 'Camera not found'); return; }

      if (camera.config.objects?.filters?.[req.params.label]) {
        delete camera.config.objects.filters[req.params.label];
      }
      this.ok(res, { message: `Filter for ${req.params.label} deleted` });
    } catch (error) {
      this.serverError(res, error, 'deleteFilter');
    }
  }
}

export const cameraController = new CameraController();
