import { Server as SocketIOServer } from "socket.io";
import path from "path";
import { promises as fsp } from "fs";
import { fileURLToPath } from "url";
import { generateTestJpegFrame } from "../utils/testImageGenerator.js";
import { logger } from "../utils/logger.js";
import { config, getCameraById, getDetectionsPath, getEventPath, CameraConfig } from "../config/index.js";
import { AppDataSource } from "../database.js";
import { Event } from "../models/Event.js";
import { StreamHealthMonitor } from "./streamHealthMonitor.js";
import { serviceRegistry } from "../services/serviceRegistry.js";
import { encryptCredential } from "../services/credentialEncryption.js";
import { getOpenCVClient } from "../services/opencvMicroserviceClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAMERAS_CONFIG_PATH = path.join(__dirname, '../../cameras.json');

export interface Camera {
  id: string;
  name: string;
  config: CameraConfig;
  isActive: boolean;
  lastFrame: Buffer | null;
  activeViewers: Set<string>;
  adaptiveFps: number;
  lastFrameEmitTime: number;
}

const configuredCameras: CameraConfig[] = config.cameras;

export class StreamManager {
  cameras: Map<string, Camera>;
  io: SocketIOServer;
  frameInterval: number;
  healthMonitor: StreamHealthMonitor;
  private unsubscribeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly UNSUBSCRIBE_GRACE_MS = 30000;
  private activeSubscriptions: Set<string> = new Set();
  private initializing: boolean = true;
  private encryptionWarningLogged: boolean = false;

  constructor(io: SocketIOServer) {
    this.cameras = new Map();
    this.io = io;
    this.frameInterval = config.streaming.frameInterval;

    this.healthMonitor = new StreamHealthMonitor(io, {
      intervalMs: 30000,
      staleThresholdMs: 120000,
      maxRestarts: 3
    });
    this.healthMonitor.setStreamManager(this);

    configuredCameras.forEach((cameraConfig) => {
      this.addCamera(cameraConfig);
    });

    this.initializing = false;

    this.persistCameras().catch(err => {
      logger.error(`Failed to persist cameras after init: ${err}`, 'StreamManager');
    });

    this.setupConnectionTracking();
    this.wirePythonWsFrames();
  }

  private debouncedUnsubscribe(cameraId: string): void {
    const existing = this.unsubscribeTimers.get(cameraId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.unsubscribeTimers.delete(cameraId);
      const camera = this.cameras.get(cameraId);
      if (camera && camera.activeViewers.size === 0) {
        const pythonWs = serviceRegistry.getPythonWsClient();
        if (pythonWs && pythonWs.connected) {
          pythonWs.unsubscribe(cameraId);
          this.activeSubscriptions.delete(cameraId);
        }
      }
    }, this.UNSUBSCRIBE_GRACE_MS);
    this.unsubscribeTimers.set(cameraId, timer);
  }

  private cancelDebouncedUnsubscribe(cameraId: string): void {
    const existing = this.unsubscribeTimers.get(cameraId);
    if (existing) {
      clearTimeout(existing);
      this.unsubscribeTimers.delete(cameraId);
    }
  }

  private wirePythonWsFrames(): void {
    const pythonWs = serviceRegistry.getPythonWsClient();
    if (pythonWs) {
      // When the Python WebSocket client connects, subscribe to all cameras to keep streams always on.
      pythonWs.on('connected', () => {
        this.cameras.forEach((_, camId) => {
          if (!this.activeSubscriptions.has(camId)) {
            pythonWs.subscribe(camId);
            this.activeSubscriptions.add(camId);
          }
        });
      });
    }
    if (!pythonWs) return;

    pythonWs.on('frame', (message: { cameraId: string | null; data: Buffer; timestamp: number }) => {
      const { cameraId, data } = message;
      if (!cameraId) return;

      const camera = this.cameras.get(cameraId);
      if (!camera) return;

      camera.lastFrame = data;
      this.healthMonitor.recordFrameEmitted(cameraId, 'live');

      const viewerCount = camera.activeViewers.size;
      const adaptiveFps = this.getOptimalFps(viewerCount);
      camera.adaptiveFps = adaptiveFps;

      const now = Date.now();
      const frameIntervalMs = 1000 / adaptiveFps;
      if (now - camera.lastFrameEmitTime < frameIntervalMs) {
        return;
      }
      camera.lastFrameEmitTime = now;

      const roomName = `camera-${cameraId}-live`;
      if (viewerCount > 0) {
        this.io.to(roomName).emit("frame", {
          cameraId,
          role: 'live',
          timestamp: new Date().toISOString(),
          data
        });
      }

      const detectRoom = `camera-${cameraId}-detect`;
      this.io.to(detectRoom).emit("frame", {
        cameraId,
        role: 'detect',
        timestamp: new Date().toISOString(),
        data
      });
    });
  }

  private setupConnectionTracking(): void {
    this.io.on('connection', (socket) => {
      socket.on('requestStream', (data: { cameraId: string; role?: 'live' | 'detect' | 'record'; tier?: 'HIGH' | 'MEDIUM' | 'LOW' }) => {
        const { cameraId, role = 'live', tier = 'MEDIUM' } = data;
         logger.info(`Received requestStream for camera ${cameraId} role ${role} tier ${tier}`, 'STREAM');
        const camera = this.cameras.get(cameraId);
        if (!camera) {
          socket.emit('streamError', { cameraId, error: 'Camera not found' });
          return;
        }

        camera.activeViewers.add(socket.id);
        const viewerCount = camera.activeViewers.size;

        const roomName = `camera-${cameraId}-live`;
        socket.join(roomName);

        camera.isActive = true;

        this.cancelDebouncedUnsubscribe(cameraId);

        const pythonWs = serviceRegistry.getPythonWsClient();
        if (pythonWs && pythonWs.connected && !this.activeSubscriptions.has(cameraId)) {
          pythonWs.subscribe(cameraId);
          this.activeSubscriptions.add(cameraId);
        }

        socket.emit('streamStarted', {
          cameraId,
          role,
          fps: camera.adaptiveFps,
          viewerCount,
          tier,
        });
      });

      socket.on('stopStream', (data: { cameraId: string; role?: 'live' | 'detect' | 'record' }) => {
        const { cameraId, role = 'live' } = data;
        const camera = this.cameras.get(cameraId);
        if (!camera) return;

        camera.activeViewers.delete(socket.id);
        socket.leave(`camera-${cameraId}-${role}`);

        if (camera.activeViewers.size === 0) {
          this.debouncedUnsubscribe(cameraId);
        }

        socket.emit('streamStopped', {
          cameraId,
          role,
          viewerCount: camera.activeViewers.size
        });
      });

      socket.on('disconnect', () => {
        this.cameras.forEach((camera, cameraId) => {
          if (camera.activeViewers.has(socket.id)) {
            camera.activeViewers.delete(socket.id);
            if (camera.activeViewers.size === 0) {
              this.debouncedUnsubscribe(cameraId);
            }
          }
        });
      });
    });
  }

  private getOptimalFps(viewerCount: number): number {
    if (viewerCount === 0) return 1;
    if (viewerCount <= 3) return 4;
    if (viewerCount <= 10) return 3;
    if (viewerCount <= 20) return 2;
    return 1;
  }

  addCamera(cameraConfig: CameraConfig): string {
    const camera: Camera = {
      id: cameraConfig.id,
      name: cameraConfig.name,
      config: cameraConfig,
      isActive: false,
      lastFrame: null,
      activeViewers: new Set<string>(),
      adaptiveFps: 4,
      lastFrameEmitTime: 0,
    };

    this.cameras.set(camera.id, camera);

    if (!this.initializing) {
      this.persistCameras().catch(err => {
        logger.error(`Failed to persist cameras after addCamera: ${err}`, 'StreamManager');
      });
    }

    return camera.id;
  }

  getAllCameras(): Camera[] {
    return Array.from(this.cameras.values());
  }

  getCamera(id: string): Camera | undefined {
    return this.cameras.get(id);
  }

  startStream(cameraId: string, _role?: 'live' | 'detect' | 'record'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    camera.isActive = true;

    if (this.activeSubscriptions.has(cameraId)) {
      logger.debug(`Subscription already exists for camera ${cameraId}, skipping duplicate`, 'StreamManager');
      return true;
    }

    const pythonWs = serviceRegistry.getPythonWsClient();
    if (pythonWs && pythonWs.connected) {
      pythonWs.subscribe(cameraId);
      this.activeSubscriptions.add(cameraId);
    }

    return true;
  }

  stopStream(cameraId: string, _role?: 'live' | 'detect' | 'record'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    if (_role) {
      this.healthMonitor.recordStreamStopped(cameraId, _role);
    }

    if (!_role || camera.activeViewers.size === 0) {
      const pythonWs = serviceRegistry.getPythonWsClient();
      if (pythonWs && pythonWs.connected) {
        pythonWs.unsubscribe(cameraId);
        this.activeSubscriptions.delete(cameraId);
      }
      camera.isActive = false;
    }

    return true;
  }

  restartStream(cameraId: string, role?: 'live' | 'detect' | 'record'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    const pythonWs = serviceRegistry.getPythonWsClient();
    if (pythonWs && pythonWs.connected && !this.activeSubscriptions.has(cameraId)) {
      pythonWs.subscribe(cameraId);
      this.activeSubscriptions.add(cameraId);
    }

    camera.isActive = true;
    return true;
  }

  startTestStream(cameraId: string, _role?: 'live' | 'detect' | 'record') {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;

    if ((camera as any)._testInterval) {
      clearInterval((camera as any)._testInterval);
    }

    camera.isActive = true;
    camera.lastFrame = null;

    const interval = setInterval(() => {
      try {
        const testFrame = generateTestJpegFrame(cameraId);
        camera.lastFrame = testFrame;

        this.io.to(`camera-${cameraId}-live`).emit("frame", {
          cameraId,
          role: 'live',
          data: testFrame,
          timestamp: new Date().toISOString(),
        });
      } catch (error: unknown) {
        clearInterval(interval);
      }
    }, 250);

    (camera as any)._testInterval = interval;
  }

  updateCamera(cameraId: string, updates: Partial<CameraConfig>): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    Object.assign(camera.config, updates);

    if (!this.initializing) {
      this.persistCameras().catch(err => {
        logger.error(`Failed to persist cameras after updateCamera: ${err}`, 'StreamManager');
      });
    }

    return true;
  }

  removeCamera(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    if (camera.isActive) {
      const pythonWs = serviceRegistry.getPythonWsClient();
      if (pythonWs && pythonWs.connected) {
        pythonWs.unsubscribe(cameraId);
        this.activeSubscriptions.delete(cameraId);
      }
    }

    this.cameras.delete(cameraId);

    if (!this.initializing) {
      this.persistCameras().catch(err => {
        logger.error(`Failed to persist cameras after removeCamera: ${err}`, 'StreamManager');
      });
    }

    return true;
  }

  async takeSnapshot(
    cameraId: string,
    _resolution?: string,
  ): Promise<string | null> {
    const camera = this.cameras.get(cameraId);
    if (!camera) return null;

    const frame = camera.lastFrame;
    if (!frame) {
       logger.warn(`No frame available for snapshot for camera ${cameraId}`, 'STREAM');
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `snapshot_${cameraId}_${timestamp}.jpg`;
      const snapshotDate = new Date();
      const snapshotsPath = getDetectionsPath('snapshots', snapshotDate);
      const filepath = path.join(snapshotsPath, filename);

      await fsp.mkdir(snapshotsPath, { recursive: true });

      await fsp.writeFile(filepath, frame);
      return filename;
    } catch (error: any) {
       logger.error(`Error saving snapshot for camera ${cameraId}: ${error.message}`, 'STREAM');
      return null;
    }
  }

  getLastFrame(cameraId: string): Buffer | null {
    const camera = this.cameras.get(cameraId);
    if (!camera) return null;
    return camera.lastFrame || null;
  }

  getCurrentFrame(cameraId: string): Buffer | null {
    return this.getLastFrame(cameraId);
  }

  toggleNightMode(cameraId: string, enabled: boolean): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    camera.config.nightMode = enabled;
    logger.info(
      `Night mode ${enabled ? "enabled" : "disabled"} for camera ${cameraId}`,
      'StreamManager',
    );

    if (!this.initializing) {
      this.persistCameras().catch(err => {
        logger.error(`Failed to persist cameras after toggleNightMode: ${err}`, 'StreamManager');
      });
    }

    const opencvClient = getOpenCVClient();
    opencvClient.pushDetectionConfig(cameraId, camera.config as unknown as Record<string, unknown>).catch(err => {
      logger.warn(`Failed to push night mode config to Python: ${err}`, 'StreamManager');
    });

    return true;
  }

  async persistCameras(): Promise<void> {
    try {
      const serializable = Array.from(this.cameras.values()).map(camera => {
        const cfg = camera.config;
        return {
          ...cfg,
          streams: cfg.streams.map(stream => ({
            ...stream,
            path: encryptCredential(stream.path)
          }))
        };
      });
      const tmpPath = CAMERAS_CONFIG_PATH + '.tmp';
      await fsp.writeFile(tmpPath, JSON.stringify(serializable, null, 2), 'utf8');
      await fsp.rename(tmpPath, CAMERAS_CONFIG_PATH);
      logger.info('Camera config persisted to cameras.json', 'StreamManager');
    } catch (error) {
      logger.error(`Failed to persist camera config: ${error}`, 'StreamManager');
    }
  }

  async simulateMotionDetection(cameraId: string) {
    const camera = this.cameras.get(cameraId);
    if (!camera || !camera.isActive) return;

    const filename = await this.takeSnapshot(cameraId);
    if (!filename) {
       logger.error(`[StreamManager] Failed to take snapshot for simulation on ${cameraId}`, 'STREAM');
      return;
    }

    const timestamp = new Date().toISOString();

    const detections = [
      { class: 'person', confidence: 0.85, bbox: { x: 100, y: 50, width: 80, height: 180 } },
      { class: 'car', confidence: 0.72, bbox: { x: 300, y: 200, width: 120, height: 80 } }
    ];

    this.io.to(`camera-${cameraId}-live`).emit('detection', {
      cameraId,
      detections,
      timestamp,
    });

    this.io.to(`camera-${cameraId}`).emit('detection', {
      cameraId,
      detections,
      timestamp,
    });

    this.io.emit("motionDetected", {
      id: `motion_${Date.now()}`,
      cameraId,
      timestamp,
      confidence: 85,
      labels: ['person', 'car'],
      detections,
      detectionResolution: { width: 1920, height: 1080 }
    });

    try {
      const event = new Event();
      event.event_type = 'motion';
      event.camera_id = cameraId;
      const snapshotDate = new Date();
      const yearMonth = `${snapshotDate.getFullYear()}-${String(snapshotDate.getMonth() + 1).padStart(2, '0')}`;
       event.file_path = path.join(config.storage.detectionsDir, yearMonth, 'snapshots', filename);
      event.timestamp = new Date(timestamp);
      event.confidence = 0.85;
      event.persons_detected = 1;
      event.faces_detected = 0;
      event.known_faces_count = 0;
      event.unknown_faces_count = 0;
      event.object_detections = detections;
      event.face_detections = [];
      event.metadata = JSON.stringify({
        confidence: 85,
        simulated: true,
        hasPersons: true,
        hasFaces: false,
        personCount: 1,
        faceCount: 0
      });

      await AppDataSource.getRepository(Event).save(event);
    } catch (error) {
       logger.error('[StreamManager] Failed to save simulation event to database', 'STREAM', error);
    }
  }

  getProcess(_cameraId: string, _role: 'live' | 'detect' | 'record'): null {
    return null;
  }

  getStream(_cameraId: string, _role: 'live' | 'detect' | 'record'): { width: number; height: number } | undefined {
    const camera = this.cameras.get(_cameraId);
    if (!camera) return undefined;
    return { width: camera.config.streams[0]?.width || 1920, height: camera.config.streams[0]?.height || 1080 };
  }

  shutdown(): void {
    this.healthMonitor.stop();

    this.unsubscribeTimers.forEach((timer) => clearTimeout(timer));
    this.unsubscribeTimers.clear();

    this.cameras.forEach((camera) => {
      if ((camera as any)._testInterval) {
        clearInterval((camera as any)._testInterval);
      }
      camera.isActive = false;
      camera.activeViewers.clear();

      const pythonWs = serviceRegistry.getPythonWsClient();
      if (pythonWs && pythonWs.connected) {
        pythonWs.unsubscribe(camera.id);
        this.activeSubscriptions.delete(camera.id);
      }
    });
  }
}

let streamManager: StreamManager;

export async function setupRTSPStreams(
  io: SocketIOServer,
): Promise<StreamManager> {
   logger.info("Setting up RTSP stream manager", 'STREAM');
  streamManager = new StreamManager(io);

  streamManager.healthMonitor.start();
   logger.info("Stream health monitor started", 'STREAM');

  setTimeout(() => {
    streamManager.getAllCameras().forEach((camera) => {
       logger.info(`Auto-starting RTSP stream for camera: ${camera.id} (${camera.name})`, 'STREAM');
      streamManager.startStream(camera.id, 'live');
    });
  }, 2000);

  return streamManager;
}

export { streamManager };
