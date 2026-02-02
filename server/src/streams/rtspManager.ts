import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { generateTestJpegFrame } from "../utils/testImageGenerator.js";
import { logger } from "../utils/logger.js";
import { config, getCameraById, getDetectionsPath, getEventPath, CameraConfig, CameraStreamConfig } from "../config/index.js";
import { motionTriggeredDetection } from "../detection/motionTriggeredDetection.js";
import { AppDataSource } from "../database.js";
import { Event } from "../models/Event.js";
import { OptimizedMotionDetector } from "../detection/optimizedMotionDetection.js";

// Import ffmpeg-static safely
import ffmpegStatic from "ffmpeg-static";
import { execSync } from "child_process";

// Determine ffmpeg path: prefer system ffmpeg (for Docker/Alpine), fallback to static
let ffmpegPath = ffmpegStatic as unknown as string;
try {
  execSync("which ffmpeg", { stdio: "ignore" });
  ffmpegPath = "ffmpeg";
  console.log("Using system ffmpeg");
} catch (e) {
  console.log("Using ffmpeg-static: " + ffmpegPath);
}

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stream types for single-stream architecture (shared FFmpeg process)
export interface CameraStream {
  role: 'detect' | 'record' | 'live';
  url: string;
  process: ChildProcessWithoutNullStreams | null;
  isActive: boolean;
  lastFrame: Buffer | null;
  lastFrameSentTime?: number;
  width: number;
  height: number;
  fps: number;
}

// Define camera interface with single shared process
export interface Camera {
  id: string;
  name: string;
  config: CameraConfig;
  streams: Map<string, CameraStream>;
  isActive: boolean;
  nightMode: boolean;
  retryCount: number;
  lastError?: string;
  mainProcess: ChildProcessWithoutNullStreams | null; // Single FFmpeg process shared across all roles
  activeRoles: Set<'detect' | 'record' | 'live'>; // Track which roles are currently requested
}

// Load camera configuration from config (already converted to new format)
const configuredCameras: CameraConfig[] = config.cameras;

// Camera manager
export class StreamManager {
  cameras: Map<string, Camera>;
  io: SocketIOServer;
  frameInterval: number;

  constructor(io: SocketIOServer) {
    this.cameras = new Map();
    this.io = io;
    this.frameInterval = config.streaming.frameInterval;

    // Initialize configured cameras
    configuredCameras.forEach((cameraConfig) => {
      this.addCamera(cameraConfig);
    });

    // Setup event listeners for motion detection
    this.setupDetectionEventListeners();

    // Start periodic detection
    motionTriggeredDetection.startPeriodicDetection(this);
  }

  private setupDetectionEventListeners(): void {
    // Listen for EventEmitter events from motionTriggeredDetection
    motionTriggeredDetection.on('motionDetected', (event: any) => {
      this.emitDetectionEvent(event);
    });

    // Also listen for Socket.IO events from simulation (simulateMotionDetection emits via Socket.IO)
    this.io.on('motionDetected', (event: any) => {
      this.emitDetectionEvent(event);
    });
  }

  private emitDetectionEvent(event: any): void {
    const cameraId = event.cameraId;
    
    // Get camera info for resolution mapping
    const camera = this.cameras.get(cameraId);
    const liveStream = camera?.streams.get('live');
    const detectStream = camera?.streams.get('detect');
    
    // Emit detection event to frontend for visualization
    this.io.to(`camera-${cameraId}-live`).emit('detection', {
      cameraId,
      detections: event.detections || [],
      timestamp: event.timestamp,
      // Resolution info for proper scaling
      detectionResolution: event.detectionResolution || { width: detectStream?.width || 640, height: detectStream?.height || 360 },
      displayResolution: { width: liveStream?.width || 1920, height: liveStream?.height || 1080 },
      metadata: event.metadata
    });

    // Also emit to general camera room for broader access
    this.io.to(`camera-${cameraId}`).emit('detection', {
      cameraId,
      detections: event.detections || [],
      timestamp: event.timestamp,
      detectionResolution: event.detectionResolution || { width: detectStream?.width || 640, height: detectStream?.height || 360 },
      displayResolution: { width: liveStream?.width || 1920, height: liveStream?.height || 1080 },
      metadata: event.metadata
    });

    console.log(`[StreamManager] Emitted detection event for ${cameraId}: ${event.metadata?.totalDetections || 0} objects detected`);
  }

  // Add a camera to the manager
  addCamera(cameraConfig: CameraConfig): string {
    const camera: Camera = {
      id: cameraConfig.id,
      name: cameraConfig.name,
      config: cameraConfig,
      streams: new Map(),
      isActive: false,
      nightMode: cameraConfig.nightMode || false,
      retryCount: 0,
      mainProcess: null,
      activeRoles: new Set()
    };

    // Initialize streams from config (all roles share same stream URL)
    cameraConfig.streams.forEach((streamConfig) => {
      streamConfig.roles.forEach((role) => {
        camera.streams.set(role, {
          role: role,
          url: streamConfig.path, // All roles share same URL
          process: null, // Each stream object has null, mainProcess is used
          isActive: false,
          lastFrame: null,
          width: streamConfig.width || 1920,
          height: streamConfig.height || 1080,
          fps: streamConfig.fps || 4
        });
        });
      });

    this.cameras.set(camera.id, camera);
    return camera.id;
  }

  // Get all cameras
  getAllCameras(): Camera[] {
    return Array.from(this.cameras.values());
  }

  // Get a specific camera
  getCamera(id: string): Camera | undefined {
    return this.cameras.get(id);
  }

  // Get stream by camera ID and role
  getStream(cameraId: string, role: 'detect' | 'record' | 'live'): CameraStream | undefined {
    const camera = this.cameras.get(cameraId);
    if (!camera) return undefined;
    return camera.streams.get(role);
  }

  // Get the ffmpeg process for a camera stream
  getProcess(cameraId: string, role: 'detect' | 'record' | 'live'): ChildProcessWithoutNullStreams | null {
    const stream = this.getStream(cameraId, role);
    if (!stream || !stream.isActive || !stream.process) return null;
    return stream.process as ChildProcessWithoutNullStreams;
  }

  // Start streaming from a camera with specific role (single-stream architecture)
  startStream(cameraId: string, role: 'detect' | 'record' | 'live'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    const stream = camera.streams.get(role);
    if (!stream) {
      console.error(`Stream role ${role} not configured for camera ${cameraId}`);
      return false;
    }

    // Check if this role is already active
    if (camera.activeRoles.has(role)) {
      console.log(`Camera ${cameraId} ${role} stream is already active`);
      return true;
    }

    // Start main FFmpeg process if not already running (first role request)
    if (!camera.mainProcess || !camera.mainProcess.pid) {
      try {
        // Get the main stream URL (stream1)
        const mainStreamUrl = stream.url;

        // Build ffmpeg args - use 1920x1080 @ 4fps for all roles
        const ffmpegArgs = [
          "-loglevel", "error",
          "-rtsp_transport", "tcp",
          "-timeout", "5000000",
          "-err_detect", "ignore_err",
          "-fflags", "+discardcorrupt+genpts+genpts",
          "-max_delay", "1000000",
          "-probesize", "32768",
          "-analyzeduration", "500000",
          "-i", mainStreamUrl,
          "-f", "mjpeg",
          "-pix_fmt", "yuvj420p",
          "-vcodec", "mjpeg",
          "-q:v", "5",  // Good quality for all uses
          "-threads", "4",
          "-r", "4",  // 4 FPS for live streaming
          "-vf", camera.nightMode
            ? `scale=1920:1080,eq=gamma=1.5:contrast=1.2:brightness=0.2`
            : `scale=1920:1080`,
          "pipe:1",
        ];

        console.log(`*** CAMERA ${cameraId} STARTING SINGLE SHARED STREAM (1920x1080 @ 4fps) for role: ${role} ***`);

        const process = spawn(ffmpegPath, ffmpegArgs, {
          stdio: ["pipe", "pipe", "pipe"],
        });

        camera.mainProcess = process;
        camera.isActive = true;

        // Handle process errors
        process.on("error", (err) => {
          console.error(`FFMPEG error for ${cameraId}: ${err.message}`);
          camera.mainProcess = null;
          camera.activeRoles.clear();
          camera.streams.forEach((s) => { s.isActive = false; s.process = null; });
        });

        // Handle process exit
        process.on("exit", (code: number) => {
          console.log(`FFMPEG ${cameraId} exited with code ${code}`);
          camera.mainProcess = null;
          camera.activeRoles.clear();
          camera.streams.forEach((s) => { s.isActive = false; s.process = null; });

          // Auto-restart on unexpected exit
          if (code !== 0 && camera.retryCount < 5) {
            camera.retryCount++;
            setTimeout(() => this.startStream(cameraId, role), 5000 * camera.retryCount);
          }
        });

        // Handle output data - shared across all roles
        let buffer = Buffer.alloc(0);
        process.stdout.on("data", (data: Buffer) => {
          buffer = Buffer.concat([buffer, data]);

          let startMarkerPos = -1;
          let endMarkerPos = -1;

          while (true) {
            startMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd8]));
            if (startMarkerPos === -1) break;
            endMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd9]), startMarkerPos);
            if (endMarkerPos === -1) break;

            const frameBuffer = buffer.slice(startMarkerPos, endMarkerPos + 2);
            buffer = buffer.slice(endMarkerPos + 2);

            // Update all stream objects with current frame
            camera.streams.forEach((s) => {
              s.lastFrame = frameBuffer;
            });

            // Emit frames to all active roles (without client count check)
            camera.activeRoles.forEach((activeRole) => {
              const roleStream = camera.streams.get(activeRole);
              if (roleStream) {
                const roomName = `camera-${cameraId}-${activeRole}`;

                const now = Date.now();
                const fps = 4; // Fixed 4 FPS for all roles
                const frameInterval = 1000 / fps;

                if (!roleStream.lastFrameSentTime || now - roleStream.lastFrameSentTime >= frameInterval) {
                  roleStream.lastFrameSentTime = now;

                  // Emit frame to room - let Socket.io handle room lookup
                  this.io.to(roomName).emit("frame", {
                    cameraId,
                    role: activeRole,
                    data: frameBuffer.toString("base64"),
                    timestamp: new Date().toISOString(),
                  });

                  // Debug logging
                  if (cameraId === 'cam2') {
                     console.log(`[StreamManager] Emitted frame to ${roomName}, size: ${frameBuffer.length}`);
                   }
                 }
               }
             });

            // Process detect frames for motion detection (only one time per frame)
            if (camera.activeRoles.has('detect')) {
              this.processFrameForMotion(cameraId, frameBuffer);
            }
          }
        });

      } catch (error: any) {
        console.error(`Error starting shared stream for ${cameraId}: ${error.message}`);
        return false;
      }
    }

    // Mark this role as active
    camera.activeRoles.add(role);
    const roleStream = camera.streams.get(role);
    if (roleStream) {
      roleStream.isActive = true;
    }

    console.log(`Camera ${cameraId} ${role} role activated (sharing main FFmpeg process)`);
    return true;
  }

  // Stop streaming from a camera (single-stream architecture)
  stopStream(cameraId: string, role?: 'detect' | 'record' | 'live'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    if (role) {
      // Remove specific role from active set
      camera.activeRoles.delete(role);
      const stream = camera.streams.get(role);
      if (stream) {
        stream.isActive = false;
      }

      // If no more roles are active, kill the main FFmpeg process
      if (camera.activeRoles.size === 0 && camera.mainProcess) {
        console.log(`Stopping main FFmpeg process for ${cameraId} (all roles inactive)`);
        camera.mainProcess.kill('SIGTERM');
        camera.mainProcess = null;
        camera.isActive = false;

        // Mark all stream objects as inactive
        camera.streams.forEach((s) => {
          s.isActive = false;
          s.process = null;
        });
      }

      return true;
    } else {
      // Stop all streams (kill main process)
      camera.activeRoles.clear();
      if (camera.mainProcess) {
        console.log(`Stopping main FFmpeg process for ${cameraId} (stop all requested)`);
        camera.mainProcess.kill('SIGTERM');
        camera.mainProcess = null;
      }
      camera.isActive = false;

      // Mark all stream objects as inactive
      camera.streams.forEach((s) => {
        s.isActive = false;
        s.process = null;
      });

      return true;
    }

    return false;
  }

  // Restart a camera stream - useful for recovering from errors (single-stream architecture)
  restartStream(cameraId: string, role?: 'detect' | 'record' | 'live'): boolean {
    console.log(`Restarting camera ${cameraId} stream${role ? ` for role ${role}` : ' (all roles)'}`);

    // For single-stream architecture, just stop and restart the main process
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    // Kill main process
    if (camera.mainProcess) {
      camera.mainProcess.kill('SIGTERM');
      camera.mainProcess = null;
    }

    camera.activeRoles.clear();
    camera.streams.forEach((s) => {
      s.isActive = false;
      s.process = null;
    });

    // Restart after a short delay
    setTimeout(() => {
      // Start main process again - first active role will trigger it
      const rolesToStart: ('detect' | 'record' | 'live')[] = role ? [role] : ['live' as const];
      rolesToStart.forEach((r) => this.startStream(cameraId, r));
    }, 1000);

    return true;
  }

  // Start a test stream that generates fake frames
  startTestStream(cameraId: string, role?: 'detect' | 'record' | 'live') {
    const streamRole = role || 'detect';
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      console.error(`Cannot start test stream: Camera ${cameraId} not found`);
      return;
    }

    const stream = camera.streams.get(streamRole);
    if (!stream) {
      console.error(`Stream role ${streamRole} not configured for camera ${cameraId}`);
      return;
    }

    // Stop any existing process
    if (stream.process) {
      stream.process.kill();
      stream.process = null;
    }

    camera.isActive = true;
    stream.isActive = true;
    camera.lastError = "Using test stream - RTSP not available";

    // Generate test frames at the specified frame rate
    const interval = setInterval(() => {
      try {
        const testFrame = generateTestJpegFrame(cameraId);
        stream.lastFrame = testFrame;

        // Emit the test frame to clients
        this.io.to(`camera-${cameraId}-${streamRole}`).emit("frame", {
          cameraId,
          role: streamRole,
          data: testFrame.toString("base64"),
          timestamp: new Date().toISOString(),
        });

        // Process for motion detection if detect stream
        if (streamRole === 'detect') {
          this.processFrameForMotion(cameraId, testFrame);
        }
      } catch (error: unknown) {
        console.error(`Error generating test frame for camera ${cameraId}: ${(error as Error).message}`);
        clearInterval(interval);
        stream.isActive = false;
      }
    }, 1000 / stream.fps);

    // Store the interval so we can clear it later
    stream.process = {
      kill: () => clearInterval(interval)
    } as unknown as ChildProcessWithoutNullStreams;
  }

  // Update camera settings
  updateCamera(cameraId: string, updates: Partial<CameraConfig>): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    // Apply updates
    Object.assign(camera.config, updates);

    // Restart streams if config changed significantly
    if (camera.isActive) {
      this.stopStream(cameraId);
      setTimeout(() => {
        camera.streams.forEach((_value: CameraStream, streamRole: 'detect' | 'record' | 'live') => {
          this.startStream(cameraId, streamRole);
        });
      }, 1000);
    }

    return true;
  }

  // Remove a camera
  removeCamera(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    // Stop streaming if active
    if (camera.isActive) {
      this.stopStream(cameraId);
    }

    this.cameras.delete(cameraId);
    return true;
  }

  // Take a snapshot from the current frame
  async takeSnapshot(
    cameraId: string,
    resolution?: string,
  ): Promise<string | null> {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      console.error(`Cannot take snapshot: Camera ${cameraId} not found`);
      return null;
    }

    // Use detect stream for snapshots (lower resolution, faster)
    const stream = camera.streams.get('detect');
    const frame = stream?.lastFrame;
    if (!frame) {
      console.warn(`No frame available for snapshot for camera ${cameraId}`);
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `snapshot_${cameraId}_${timestamp}.jpg`;
      
      // Calculate snapshots path dynamically to avoid module-level issues
      const snapshotDate = new Date();
      const snapshotsPath = getDetectionsPath('snapshots', snapshotDate);
      const filepath = path.join(snapshotsPath, filename);

      // Ensure directory exists before writing
      if (!fs.existsSync(snapshotsPath)) {
        fs.mkdirSync(snapshotsPath, { recursive: true });
      }

      // Save the current frame as a snapshot
      fs.writeFileSync(filepath, frame);

      return filename;
    } catch (error: any) {
      console.error(`Error saving snapshot for camera ${cameraId}: ${error.message}`);
      return null;
    }
  }

  // Get last frame for a camera (from detect stream)
  getLastFrame(cameraId: string): Buffer | null {
    const camera = this.cameras.get(cameraId);
    if (!camera) return null;
    return camera.streams.get('detect')?.lastFrame || null;
  }

  // Alias for getLastFrame for consistency with detection API
  getCurrentFrame(cameraId: string): Buffer | null {
    return this.getLastFrame(cameraId);
  }

  // Toggle night mode (stub for compatibility)
  toggleNightMode(cameraId: string, enabled: boolean): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    camera.nightMode = enabled;
    logger.info(
      `Night mode ${enabled ? "enabled" : "disabled"} for camera ${cameraId}`, 'StreamManager',
    );
    return true;
  }

  // Process frame for motion detection (non-blocking)
  private async processFrameForMotion(cameraId: string, frame: Buffer): Promise<void> {
    try {
      await motionTriggeredDetection.processFrame(cameraId, frame);
    } catch (error) {
      console.error(`Motion detection processing error for ${cameraId}:`, error);
    }
  }

  // Simulate motion detection
  async simulateMotionDetection(cameraId: string) {
    const camera = this.cameras.get(cameraId);
    if (!camera || !camera.isActive) return;

    // Take a snapshot for the motion event
    const filename = await this.takeSnapshot(cameraId);
    if (!filename) {
      console.error(`[StreamManager] Failed to take snapshot for simulation on ${cameraId}`);
      return;
    }

    const timestamp = new Date().toISOString();
    
    // Create simulated detections
    const detections = [
      { class: 'person', confidence: 0.85, bbox: { x: 100, y: 50, width: 80, height: 180 } },
      { class: 'car', confidence: 0.72, bbox: { x: 300, y: 200, width: 120, height: 80 } }
    ];
    
    // Emit to live room
    this.io.to(`camera-${cameraId}-live`).emit('detection', {
      cameraId,
      detections,
      timestamp,
    });

    // Also emit to general camera room
    this.io.to(`camera-${cameraId}`).emit('detection', {
      cameraId,
      detections,
      timestamp,
    });

    // Emit motionDetected event for other listeners
    this.io.emit("motionDetected", {
      id: `motion_${Date.now()}`,
      cameraId,
      timestamp,
      confidence: 85,
      labels: ['person', 'car'],
      detections,
      detectionResolution: { width: 1920, height: 1080 }
    });

    console.log(`[StreamManager] Simulation snapshot saved: ${filename}, saving to database...`);

    // Save to database
    try {
      const event = new Event();
      event.event_type = 'motion';
      event.camera_id = cameraId;
      
      // Get the full path to the snapshot
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
      console.log(`[StreamManager] Simulation event saved to database: ${event.id}`);
    } catch (error) {
      console.error(`[StreamManager] Failed to save simulation event to database:`, error);
    }
  }
}

// Global stream manager instance
let streamManager: StreamManager;

// Setup and return the stream manager
export async function setupRTSPStreams(
  io: SocketIOServer,
): Promise<StreamManager> {
  console.log("Setting up RTSP stream manager");
  streamManager = new StreamManager(io);

  // Auto-start real RTSP streams with a delay to ensure proper initialization
  console.log("Starting RTSP streams for all cameras");
  setTimeout(() => {
    streamManager.getAllCameras().forEach((camera) => {
      console.log(
        `Auto-starting RTSP streams for camera: ${camera.id} (${camera.name})`,
      );
      // Start all configured streams
      camera.streams.forEach((_value: CameraStream, role: 'detect' | 'record' | 'live') => {
        streamManager.startStream(camera.id, role);
      });
    });
  }, 2000); // Wait 2 seconds before starting streams

    // SIMULATION MODE DISABLED - Motion simulation has been removed for production use
    // Only real motion detection from cameras will generate events
    console.log('[StreamManager] Simulation mode DISABLED - only real motion will be detected');

  return streamManager;
}

// Export the global stream manager instance
export { streamManager };
