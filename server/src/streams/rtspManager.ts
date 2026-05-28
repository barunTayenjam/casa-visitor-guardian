import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { generateTestJpegFrame } from "../utils/testImageGenerator.js";
import { logger } from "../utils/logger.js";
import { config, getCameraById, getDetectionsPath, getEventPath, CameraConfig, CameraStreamConfig } from "../config/index.js";
import { AppDataSource } from "../database.js";
import { Event } from "../models/Event.js";
import { OptimizedMotionDetector } from "../detection/optimizedMotionDetection.js";
import { StreamHealthMonitor } from "./streamHealthMonitor.js";

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
  viewerCount?: number; // Track active viewers for adaptive streaming
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
  activeViewers: Set<string>; // Track active socket IDs for adaptive streaming
  adaptiveFps: number; // Current FPS based on viewer count
}

// Load camera configuration from config (already converted to new format)
const configuredCameras: CameraConfig[] = config.cameras;

// Camera manager
export class StreamManager {
  cameras: Map<string, Camera>;
  io: SocketIOServer;
  frameInterval: number;
  healthMonitor: StreamHealthMonitor;

  constructor(io: SocketIOServer) {
    this.cameras = new Map();
    this.io = io;
    this.frameInterval = config.streaming.frameInterval;

    // Initialize health monitor with configurable settings
    this.healthMonitor = new StreamHealthMonitor(io, {
      intervalMs: 30000, // Check every 30 seconds
      staleThresholdMs: 120000, // 2 minutes without frames = stale
      maxRestarts: 3 // Max 3 restarts per hour per camera
    });
    this.healthMonitor.setStreamManager(this);

    // Initialize configured cameras
    configuredCameras.forEach((cameraConfig) => {
      this.addCamera(cameraConfig);
    });

    // Auto-start detect role for all cameras (always-on detection)
    configuredCameras.forEach((cameraConfig) => {
      this.startStream(cameraConfig.id, 'detect');
    });

    // Setup event listeners for motion detection
    this.setupDetectionEventListeners();


  }

  private setupDetectionEventListeners(): void {
    // Listen for Socket.IO events from simulation (simulateMotionDetection emits via Socket.IO)
    this.io.on('motionDetected', (event: any) => {
      this.emitDetectionEvent(event);
    });

    // Setup Socket.IO connection tracking for adaptive streaming
    this.setupConnectionTracking();
  }

  // Track active viewers for adaptive streaming
  private setupConnectionTracking(): void {
    this.io.on('connection', (socket) => {
      console.log(`[StreamManager] Client connected: ${socket.id}`);

      // Handle stream requests with viewer tracking
      socket.on('requestStream', (data: { cameraId: string; tier?: 'HIGH' | 'MEDIUM' | 'LOW' }) => {
        const { cameraId, tier = 'MEDIUM' } = data;
        const camera = this.cameras.get(cameraId);

        if (!camera) {
          socket.emit('streamError', { cameraId, error: 'Camera not found' });
          return;
        }

        // Cancel any pending inactivity timeout (viewer reconnecting)
        const pendingTimeout = (camera as any).pendingInactivityTimeout;
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          (camera as any).pendingInactivityTimeout = null;
          console.log(`[StreamManager] Camera ${cameraId}: cancelled inactivity timeout (viewer reconnecting)`);
        }

        // Track viewer
        camera.activeViewers.add(socket.id);
        const viewerCount = camera.activeViewers.size;
        console.log(`[StreamManager] Camera ${cameraId}: ${viewerCount} viewers`);

        // Join appropriate room
        const roomName = `camera-${cameraId}-live`;
        socket.join(roomName);

        // Start stream if not already active
        if (!camera.activeRoles.has('live')) {
          this.startStream(cameraId, 'live');
        }

        // Send current FPS
        socket.emit('streamStarted', {
          cameraId,
          fps: camera.adaptiveFps,
          viewerCount,
          tier,
        });

        // Debug logging
        if (cameraId === 'cam2') {
          console.log(`[StreamManager] Emitted frame to ${roomName}, size: ${camera.streams.get('live')?.lastFrame?.length || 0}, viewers: ${viewerCount}`);
        }
      });

      // Handle stream stops
      socket.on('stopStream', (data: { cameraId: string }) => {
        const { cameraId } = data;
        const camera = this.cameras.get(cameraId);

        if (camera) {
          // Remove viewer
          camera.activeViewers.delete(socket.id);
          const viewerCount = camera.activeViewers.size;
          console.log(`[StreamManager] Camera ${cameraId}: ${viewerCount} viewers (after disconnect)`);

          // Leave room
          socket.leave(`camera-${cameraId}-live`);

          // Stop stream if no more viewers
          if (viewerCount === 0 && camera.activeRoles.has('live')) {
            this.stopStream(cameraId, 'live');
          }

          // CRITICAL: Never stop detect role regardless of viewer count
          if (viewerCount === 0 && camera.activeRoles.has('detect')) {
            console.log(`[StreamManager] Keeping detect stream active for camera ${cameraId} (always-on detection)`);
            // Ensure detect stays active
          }

          socket.emit('streamStopped', { cameraId, viewerCount });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`[StreamManager] Client disconnected: ${socket.id}`);

        // Remove from all camera viewer lists
        this.cameras.forEach((camera, cameraId) => {
          if (camera.activeViewers.has(socket.id)) {
            camera.activeViewers.delete(socket.id);
            const viewerCount = camera.activeViewers.size;
            console.log(`[StreamManager] Camera ${cameraId}: ${viewerCount} viewers (after disconnect)`);

            // Stop stream if no more viewers
            if (viewerCount === 0 && camera.activeRoles.has('live')) {
              this.stopStream(cameraId, 'live');
            }

            // CRITICAL: Never stop detect role regardless of viewer count
            if (viewerCount === 0 && camera.activeRoles.has('detect')) {
              console.log(`[StreamManager] Keeping detect stream active for camera ${cameraId} (always-on detection)`);
            }
          }
        });
      });
    });
  }

  // Calculate optimal FPS based on viewer count
  private getOptimalFps(viewerCount: number): number {
    // Adaptive FPS strategy:
    // 0-3 viewers: 4 FPS (high quality)
    // 4-10 viewers: 3 FPS (medium)
    // 11-20 viewers: 2 FPS (low)
    // 21+ viewers: 1 FPS (minimal)
    if (viewerCount === 0) return 1; // Minimal when no viewers
    if (viewerCount <= 3) return 4;
    if (viewerCount <= 10) return 3;
    if (viewerCount <= 20) return 2;
    return 1;
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
      activeRoles: new Set(),
      activeViewers: new Set<string>(),
      adaptiveFps: 4, // Start with 4 FPS
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
          lastFrameSentTime: undefined,
          width: streamConfig.width || 1920,
          height: streamConfig.height || 1080,
          fps: streamConfig.fps || 4,
          viewerCount: 0,
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

        // Low-resource optimization settings
        const isLowResource = config.streaming.lowResourceMode;
        const threads = config.streaming.threads;
        const fps = config.streaming.defaultFps;
        const resolution = config.streaming.defaultResolution;
        const [resWidth, resHeight] = resolution.split('x').map(Number);

        // Build ffmpeg args - optimized for correct color output and stability
        const ffmpegArgs = [
          "-loglevel", "error",
          "-rtsp_transport", "tcp",
          "-timeout", "5000000",
          "-err_detect", "ignore_err",
          "-fflags", "+discardcorrupt+genpts",
          "-max_delay", "1000000",
          "-probesize", "1000000",
          "-analyzeduration", "2000000",
          "-i", mainStreamUrl,
          "-f", "mjpeg",
          "-vcodec", "mjpeg",
          "-q:v", isLowResource ? "8" : "5",
          "-huffman", "optimal",
          "-threads", String(threads),
          "-r", String(fps),
          "-vf", camera.nightMode
            ? `scale=${resWidth}:${resHeight},format=yuv420p,eq=gamma=1.5:contrast=1.2:brightness=0.2`
            : `scale=${resWidth}:${resHeight},format=yuv420p`,
          "pipe:1",
        ];

        console.log(`*** CAMERA ${cameraId} STARTING STREAM (${resolution} @ ${fps}fps, ${threads} threads) ***`);

        const process = spawn(ffmpegPath, ffmpegArgs, {
          stdio: ["pipe", "pipe", "pipe"],
        });

        camera.mainProcess = process;
        camera.isActive = true;

        // Handle process errors
        process.on("error", (err) => {
          console.error(`FFMPEG error for ${cameraId}: ${err.message}`);
          camera.activeRoles.forEach((activeRole) => {
            this.io.to(`camera-${cameraId}-${activeRole}`).emit('streamError', {
              cameraId,
              role: activeRole,
              error: `FFMPEG process error: ${err.message}`
            });
          });
        });

        // Handle stderr output for debugging
        process.stderr.on("data", (data: Buffer) => {
          const errorMsg = data.toString().trim();
          if (errorMsg) {
            console.warn(`FFMPEG stderr [${cameraId}]: ${errorMsg}`);
          }
        });

        // Handle process exit
        process.on("exit", (code: number, signal: string) => {
          console.log(`FFMPEG ${cameraId} exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
          camera.mainProcess = null;
          
          camera.activeRoles.forEach((activeRole) => {
            this.io.to(`camera-${cameraId}-${activeRole}`).emit('streamError', {
              cameraId,
              role: activeRole,
              error: `FFMPEG process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`
            });
          });
          
          camera.streams.forEach((s) => { s.isActive = false; s.process = null; });
          camera.activeRoles.clear();

          if (signal !== 'SIGTERM') {
            const retryDelay = 5000;
            console.log(`[StreamManager] FFmpeg exited unexpectedly for ${cameraId}, restarting detect in ${retryDelay}ms...`);
            setTimeout(() => {
              if (!camera.activeRoles.has('detect')) {
                this.startStream(cameraId, 'detect');
              }
            }, retryDelay);
          }

          // Auto-restart on unexpected exit
          if (code !== 0 && camera.retryCount < 5) {
            camera.retryCount++;
            console.log(`Attempting to restart ${cameraId} in ${5000 * camera.retryCount}ms (attempt ${camera.retryCount}/5)`);
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

            // Emit frames to all active roles with adaptive streaming
            camera.activeRoles.forEach((activeRole) => {
              const roleStream = camera.streams.get(activeRole);
              if (roleStream) {
                const roomName = `camera-${cameraId}-${activeRole}`;

                const now = Date.now();

                // Adaptive FPS based on viewer count
                const viewerCount = activeRole === 'live' ? camera.activeViewers.size : 1;
                const adaptiveFps = this.getOptimalFps(viewerCount);
                camera.adaptiveFps = adaptiveFps;
                const frameInterval = 1000 / adaptiveFps;

                if (!roleStream.lastFrameSentTime || now - roleStream.lastFrameSentTime >= frameInterval) {
                  roleStream.lastFrameSentTime = now;

                  // Emit frame with camera ID to ensure proper routing
                  // Using base64 for compatibility (binary in object can have Socket.io serialization issues)
                  this.io.to(roomName).emit("frame", {
                    cameraId,
                    role: activeRole,
                    timestamp: new Date().toISOString(),
                    data: frameBuffer.toString("base64") // Base64 encoded for reliable transmission
                  });

                  // Record frame emission for health monitoring
                  this.healthMonitor.recordFrameEmitted(cameraId, activeRole);

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

    // Cancel any pending inactivity timeout
    const pendingTimeout = (camera as any).pendingInactivityTimeout;
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      (camera as any).pendingInactivityTimeout = null;
    }

    if (role) {
      // Record stream stop for health monitoring
      this.healthMonitor.recordStreamStopped(cameraId, role);

      // Remove specific role from active set
      camera.activeRoles.delete(role);
      const stream = camera.streams.get(role);
      if (stream) {
        stream.isActive = false;
      }

      // If no more roles are active, start inactivity timeout before killing FFmpeg
      if (camera.activeRoles.size === 0 && camera.mainProcess) {
        const timeout = config.streaming.inactivityTimeout;
        
        // Start inactivity timer - only kill FFmpeg if no new viewers connect
        (camera as any).pendingInactivityTimeout = setTimeout(() => {
          if (camera.activeRoles.size === 0 && camera.mainProcess) {
            console.log(`Inactivity timeout reached - stopping main FFmpeg process for ${cameraId}`);
            camera.mainProcess.kill('SIGTERM');
            camera.mainProcess = null;
            camera.isActive = false;

            // Mark all stream objects as inactive
            camera.streams.forEach((s) => {
              s.isActive = false;
              s.process = null;
            });
          }
          (camera as any).pendingInactivityTimeout = null;
        }, timeout);
        
        console.log(`Stream inactive - will stop FFmpeg in ${timeout/1000}s if no viewers reconnect`);
        return true;
      }

      return true;
    } else {
      // Stop all streams (kill main process)
      // Record stream stop for all roles
      camera.streams.forEach((_, streamRole) => {
        this.healthMonitor.recordStreamStopped(cameraId, streamRole as 'detect' | 'record' | 'live');
      });

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

    // Add random jitter (500ms - 2000ms) to stagger multiple camera restarts
    // This prevents "DDoS" effect when multiple cameras restart simultaneously
    const jitter = Math.floor(Math.random() * 1500) + 500;

    setTimeout(() => {
      // Start main process again - first active role will trigger it
      const rolesToStart: ('detect' | 'record' | 'live')[] = role ? [role] : ['live' as const];
      rolesToStart.forEach((r) => this.startStream(cameraId, r));
    }, 1000 + jitter);

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

  // Process frame for motion detection (non-blocking) — disabled: OptimizedMotionDetector handles this
  private async processFrameForMotion(cameraId: string, frame: Buffer): Promise<void> {
    // OptimizedMotionDetector runs on its own timer via streamManager.getLastFrame()
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

  shutdown(): void {
    console.log('[StreamManager] Shutting down all streams...');

    this.healthMonitor.stop();

    for (const camera of this.cameras.values()) {
      const pendingTimeout = (camera as any).pendingInactivityTimeout;
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        (camera as any).pendingInactivityTimeout = null;
      }

      camera.activeRoles.clear();

      if (camera.mainProcess) {
        try {
          camera.mainProcess.kill('SIGTERM');
        } catch {}
        camera.mainProcess = null;
      }

      camera.isActive = false;
      camera.activeViewers.clear();

      camera.streams.forEach((s) => {
        s.isActive = false;
        s.process = null;
      });
    }

    console.log('[StreamManager] All streams stopped and FFmpeg processes killed');
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

  // Start the health monitor
  streamManager.healthMonitor.start();
  console.log("Stream health monitor started");

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
