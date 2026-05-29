import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { generateTestJpegFrame } from "../utils/testImageGenerator.js";
import { logger } from "../utils/logger.js";
import { config, getCameraById, getDetectionsPath, getEventPath, CameraConfig } from "../config/index.js";
import { AppDataSource } from "../database.js";
import { Event } from "../models/Event.js";
import { StreamHealthMonitor } from "./streamHealthMonitor.js";
import { serviceRegistry } from "../services/serviceRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Camera {
  id: string;
  name: string;
  config: CameraConfig;
  isActive: boolean;
  lastFrame: Buffer | null;
  activeViewers: Set<string>;
  adaptiveFps: number;
}

const configuredCameras: CameraConfig[] = config.cameras;

export class StreamManager {
  cameras: Map<string, Camera>;
  io: SocketIOServer;
  frameInterval: number;
  healthMonitor: StreamHealthMonitor;

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

    this.setupConnectionTracking();
    this.wirePythonWsFrames();
  }

  private wirePythonWsFrames(): void {
    const pythonWs = serviceRegistry.getPythonWsClient();
    if (!pythonWs) return;

    pythonWs.on('frame', (message: { cameraId: string | null; data: Buffer; timestamp: number }) => {
      const { cameraId, data } = message;
      if (!cameraId) return;

      const camera = this.cameras.get(cameraId);
      if (!camera) return;

      camera.lastFrame = data;
      this.healthMonitor.recordFrameEmitted(cameraId, 'live');

      const roomName = `camera-${cameraId}-live`;
      const viewerCount = camera.activeViewers.size;
      const adaptiveFps = this.getOptimalFps(viewerCount);
      camera.adaptiveFps = adaptiveFps;
      const frameIntervalMs = 1000 / adaptiveFps;

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
      socket.on('requestStream', (data: { cameraId: string; tier?: 'HIGH' | 'MEDIUM' | 'LOW' }) => {
        const { cameraId, tier = 'MEDIUM' } = data;
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

        const pythonWs = serviceRegistry.getPythonWsClient();
        if (pythonWs && pythonWs.connected) {
          pythonWs.subscribe(cameraId);
        }

        socket.emit('streamStarted', {
          cameraId,
          fps: camera.adaptiveFps,
          viewerCount,
          tier,
        });
      });

      socket.on('stopStream', (data: { cameraId: string }) => {
        const { cameraId } = data;
        const camera = this.cameras.get(cameraId);
        if (!camera) return;

        camera.activeViewers.delete(socket.id);
        socket.leave(`camera-${cameraId}-live`);

        if (camera.activeViewers.size === 0) {
          const pythonWs = serviceRegistry.getPythonWsClient();
          if (pythonWs && pythonWs.connected) {
            pythonWs.unsubscribe(cameraId);
          }
        }

        socket.emit('streamStopped', {
          cameraId,
          viewerCount: camera.activeViewers.size
        });
      });

      socket.on('disconnect', () => {
        this.cameras.forEach((camera, cameraId) => {
          if (camera.activeViewers.has(socket.id)) {
            camera.activeViewers.delete(socket.id);
            if (camera.activeViewers.size === 0) {
              const pythonWs = serviceRegistry.getPythonWsClient();
              if (pythonWs && pythonWs.connected) {
                pythonWs.unsubscribe(cameraId);
              }
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
    };

    this.cameras.set(camera.id, camera);
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

    const pythonWs = serviceRegistry.getPythonWsClient();
    if (pythonWs && pythonWs.connected) {
      pythonWs.subscribe(cameraId);
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
      }
      camera.isActive = false;
    }

    return true;
  }

  restartStream(cameraId: string, role?: 'live' | 'detect' | 'record'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    const pythonWs = serviceRegistry.getPythonWsClient();
    if (pythonWs && pythonWs.connected) {
      pythonWs.subscribe(cameraId);
    }

    camera.isActive = true;
    return true;
  }

  startTestStream(cameraId: string, _role?: 'live' | 'detect' | 'record') {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;

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
    return true;
  }

  removeCamera(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    if (camera.isActive) {
      const pythonWs = serviceRegistry.getPythonWsClient();
      if (pythonWs && pythonWs.connected) {
        pythonWs.unsubscribe(cameraId);
      }
    }

    this.cameras.delete(cameraId);
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
      console.warn(`No frame available for snapshot for camera ${cameraId}`);
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `snapshot_${cameraId}_${timestamp}.jpg`;
      const snapshotDate = new Date();
      const snapshotsPath = getDetectionsPath('snapshots', snapshotDate);
      const filepath = path.join(snapshotsPath, filename);

      if (!fs.existsSync(snapshotsPath)) {
        fs.mkdirSync(snapshotsPath, { recursive: true });
      }

      fs.writeFileSync(filepath, frame);
      return filename;
    } catch (error: any) {
      console.error(`Error saving snapshot for camera ${cameraId}: ${error.message}`);
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
    return true;
  }

  async simulateMotionDetection(cameraId: string) {
    const camera = this.cameras.get(cameraId);
    if (!camera || !camera.isActive) return;

    const filename = await this.takeSnapshot(cameraId);
    if (!filename) {
      console.error(`[StreamManager] Failed to take snapshot for simulation on ${cameraId}`);
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
      event.file_path = `/app/data/detections/${yearMonth}/snapshots/${filename}`;
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
      console.error(`[StreamManager] Failed to save simulation event to database:`, error);
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

    this.cameras.forEach((camera) => {
      if ((camera as any)._testInterval) {
        clearInterval((camera as any)._testInterval);
      }
      camera.isActive = false;
      camera.activeViewers.clear();

      const pythonWs = serviceRegistry.getPythonWsClient();
      if (pythonWs && pythonWs.connected) {
        pythonWs.unsubscribe(camera.id);
      }
    });
  }
}

let streamManager: StreamManager;

export async function setupRTSPStreams(
  io: SocketIOServer,
): Promise<StreamManager> {
  console.log("Setting up RTSP stream manager");
  streamManager = new StreamManager(io);

  streamManager.healthMonitor.start();
  console.log("Stream health monitor started");

  setTimeout(() => {
    streamManager.getAllCameras().forEach((camera) => {
      console.log(`Auto-starting RTSP stream for camera: ${camera.id} (${camera.name})`);
      streamManager.startStream(camera.id, 'live');
    });
  }, 2000);

  return streamManager;
}

export { streamManager };
