import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { generateTestJpegFrame } from "../utils/testImageGenerator.js";
import { logger } from "../utils/logger.js";
import { config, getCameraById, getDetectionsPath, getEventPath, CameraConfig, CameraStreamConfig } from "../config/index.js";
import { motionTriggeredDetection } from "../detection/motionTriggeredDetection.js";

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

// Stream types for dual-stream architecture
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

// Define camera interface
export interface Camera {
  id: string;
  name: string;
  config: CameraConfig;
  streams: Map<string, CameraStream>;
  isActive: boolean;
  nightMode: boolean;
  retryCount: number;
  lastError?: string;
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
    };

    // Initialize streams from config
    cameraConfig.streams.forEach((streamConfig) => {
      streamConfig.roles.forEach((role) => {
        camera.streams.set(role, {
          role: role,
          url: streamConfig.path,
          process: null,
          isActive: false,
          lastFrame: null,
          width: streamConfig.width || 640,
          height: streamConfig.height || 360,
          fps: streamConfig.fps || 5
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

  // Start streaming from a camera with specific role
  startStream(cameraId: string, role: 'detect' | 'record' | 'live'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    const stream = camera.streams.get(role);
    if (!stream) {
      console.error(`Stream role ${role} not configured for camera ${cameraId}`);
      return false;
    }

    if (stream.isActive) {
      console.log(`Camera ${cameraId} ${role} stream is already active`);
      return true;
    }

    // Get detect config for settings
    const detectConfig = camera.config.detect;

    try {
      // Build ffmpeg args based on role
      const isDetect = role === 'detect';
      const width = isDetect ? detectConfig.width : 1920;
      const height = isDetect ? detectConfig.height : 1080;
      const fps = isDetect ? detectConfig.fps : 15;

      const ffmpegArgs = [
        "-loglevel", "error",
        "-rtsp_transport", "tcp",
        "-timeout", "5000000",
        "-err_detect", "ignore_err",
        "-fflags", "+discardcorrupt+genpts+genpts",
        "-max_delay", "1000000",
        "-probesize", "32768",
        "-analyzeduration", "500000",
        "-i", stream.url,
        "-f", "mjpeg",
        "-pix_fmt", "yuvj420p",
        "-vcodec", "mjpeg",
        "-q:v", isDetect ? "10" : "5",  // Lower quality for detect stream
        "-threads", "4",
        "-r", fps.toString(),
        "-vf", camera.nightMode
          ? `scale=${width}:${height},eq=gamma=1.5:contrast=1.2:brightness=0.2`
          : `scale=${width}:${height}`,
        "pipe:1",
      ];

      console.log(`*** CAMERA ${cameraId} ${role.toUpperCase()} STREAM (${width}x${height} @ ${fps}fps) ***`);

      const process = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      stream.process = process;
      stream.isActive = true;
      stream.lastFrame = null;
      camera.isActive = true;

      // Handle process errors
      process.on("error", (err) => {
        console.error(`FFMPEG error for ${cameraId}/${role}: ${err.message}`);
        stream.isActive = false;
        stream.process = null;
      });

      // Handle output data
      let buffer = Buffer.alloc(0);
      process.stdout.on("data", (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        let startMarkerPos = -1;
        let endMarkerPos = -1;

        while (startMarkerPos !== -1 && endMarkerPos !== -1) {
          startMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd8]));
          if (startMarkerPos !== -1) {
            endMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd9]), startMarkerPos);
            if (endMarkerPos !== -1) {
              const frameBuffer = buffer.slice(startMarkerPos, endMarkerPos + 2);
              stream.lastFrame = frameBuffer;
              buffer = buffer.slice(endMarkerPos + 2);

              // Emit detect frames for processing
              if (role === 'detect') {
                this.processFrameForMotion(cameraId, frameBuffer);
              }

              // Emit frames to viewers
              const room = this.io.sockets.adapter.rooms.get(`camera-${cameraId}-${role}`);
              const clientCount = room ? room.size : 0;

              if (clientCount > 0) {
                const now = Date.now();
                const frameInterval = 1000 / fps;
                if (!stream.lastFrameSentTime || now - stream.lastFrameSentTime >= frameInterval) {
                  stream.lastFrameSentTime = now;
                  this.io.to(`camera-${cameraId}-${role}`).emit("frame", {
                    cameraId,
                    role,
                    data: frameBuffer.toString("base64"),
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            }
          }
        }
      });

      // Handle process exit
      process.on("exit", (code: number) => {
        console.log(`FFMPEG ${cameraId}/${role} exited with code ${code}`);
        stream.isActive = false;
        stream.process = null;

        // Check if any streams are still active
        let anyActive = false;
        camera.streams.forEach(s => {
          if (s.isActive) anyActive = true;
        });
        camera.isActive = anyActive;

        // Auto-restart on unexpected exit
        if (code !== 0 && camera.retryCount < 5) {
          camera.retryCount++;
          setTimeout(() => this.startStream(cameraId, role), 5000 * camera.retryCount);
        }
      });

      return true;
    } catch (error: any) {
      console.error(`Error starting ${role} stream for ${cameraId}: ${error.message}`);
      return false;
    }
  }

  // Stop streaming from a camera
  stopStream(cameraId: string, role?: 'detect' | 'record' | 'live'): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    if (role) {
      // Stop specific stream
      const stream = camera.streams.get(role);
      if (stream && stream.process) {
        stream.process.kill('SIGTERM');
        stream.isActive = false;
        stream.process = null;
        return true;
      }
    } else {
      // Stop all streams
      let stopped = false;
      camera.streams.forEach((stream, streamRole) => {
        if (stream.isActive && stream.process) {
          stream.process.kill('SIGTERM');
          stream.isActive = false;
          stream.process = null;
          stopped = true;
        }
      });
      camera.isActive = false;
      return stopped;
    }
    return false;
  }

  // Restart a camera stream - useful for recovering from errors
  restartStream(cameraId: string, role?: 'detect' | 'record' | 'live'): boolean {
    console.log(`Attempting to restart stream for camera ${cameraId}${role ? '/' + role : ''}`);
    
    this.stopStream(cameraId, role);
    
    setTimeout(() => {
      if (role) {
        this.startStream(cameraId, role);
      } else {
        const camera = this.cameras.get(cameraId);
        if (camera) {
          camera.streams.forEach((_value: CameraStream, streamRole: 'detect' | 'record' | 'live') => {
            this.startStream(cameraId, streamRole);
          });
        }
      }
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
  simulateMotionDetection(cameraId: string) {
    const camera = this.cameras.get(cameraId);
    if (!camera || !camera.isActive) return;

    // Motion simulation log disabled - logger.info(`Simulating motion detection for camera ${cameraId}`, 'StreamManager');

    // Emit motion detected event
    this.io.emit("motionDetected", {
      id: `motion_${Date.now()}`,
      cameraId,
      timestamp: new Date().toISOString(),
      imagePath: `/snapshots/motion_${cameraId}_${Date.now()}.jpg`,
      confidence: 0.85,
      duration: 2000,
    });

    // Take a snapshot for the motion event
    this.takeSnapshot(cameraId).catch((err) => {
      console.error("Failed to take snapshot for motion event:", err);
    });
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

  // Setup motion simulation
  setInterval(() => {
    const cameras = streamManager.getAllCameras();
    const activeCameras = cameras.filter((cam) => cam.isActive);

    if (activeCameras.length > 0) {
      // Randomly choose a camera to simulate motion on occasionally
      if (Math.random() < 0.1) {
        // 10% chance every interval
        const randomCamera =
          activeCameras[Math.floor(Math.random() * activeCameras.length)];
        streamManager.simulateMotionDetection(randomCamera.id);
      }
    }
  }, 30000); // Check every 30 seconds

  return streamManager;
}

// Export the global stream manager instance
export { streamManager };
