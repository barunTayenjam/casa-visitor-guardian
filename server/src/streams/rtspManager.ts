import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { generateTestJpegFrame } from "../utils/testImageGenerator.js";
import { logger } from "../utils/logger.js";
import { config, getCameraById } from "../config/index.js";
import { motionTriggeredDetection } from "../detection/motionTriggeredDetection.js";

// Import ffmpeg-static safely
import ffmpegStatic from "ffmpeg-static";
import { execSync } from "child_process";

// Determine ffmpeg path: prefer system ffmpeg (for Docker/Alpine), fallback to static
let ffmpegPath = ffmpegStatic as unknown as string;
try {
  // Check if ffmpeg is in PATH
  execSync("which ffmpeg", { stdio: "ignore" });
  ffmpegPath = "ffmpeg";
  console.log("Using system ffmpeg");
} catch (e) {
  console.log("Using ffmpeg-static: " + ffmpegPath);
}

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure snapshots and events directories exist
const snapshotsDir = config.storage.snapshotsDir;
const eventsDir = config.storage.eventsDir;

// Create directories if they don't exist
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
  logger.info(`Created snapshots directory: ${snapshotsDir}`, 'StreamManager');
}

if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
  logger.info(`Created events directory: ${eventsDir}`, 'StreamManager');
}

// Define camera interface
export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  process: ChildProcessWithoutNullStreams | (() => void) | null; // Allow ChildProcess or a function for test streams
  isActive: boolean;
  lastFrame: Buffer | null;
  frameRate: number;
  resolution: string;
  nightMode: boolean;
  retryCount: number; // Track connection retry attempts
  lastError?: string; // Store the last error message
  lastFrameSentTime?: number; // Track when the last frame was sent to limit frame rate
}

// Load camera configuration from secure config
const configuredCameras: Omit<Camera, "process" | "isActive" | "lastFrame" | "lastFrameSentTime">[] = config.cameras.map(camera => ({
  id: camera.id,
  name: camera.name,
  rtspUrl: camera.rtspUrl,
  username: camera.username,
  password: camera.password,
  frameRate: camera.frameRate,
  resolution: camera.resolution,
  nightMode: camera.nightMode,
  retryCount: 0,
}));

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
    configuredCameras.forEach((camera) => {
      this.addCamera(camera);
    });
  }

  // Add a camera to the manager
  addCamera(
    cameraConfig: Omit<Camera, "process" | "isActive" | "lastFrame" | "lastFrameSentTime">,
  ): string {
    const camera: Camera = {
      ...cameraConfig,
      process: null,
      isActive: false,
      lastFrame: null,
      lastFrameSentTime: undefined,
    };
    this.cameras.set(camera.id, camera);
    // Camera addition log disabled - logger.info(`Added camera: ${camera.id} (${camera.name})`, 'StreamManager');
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

  // Get the ffmpeg process for a camera
  getProcess(id: string): ChildProcessWithoutNullStreams | null {
    const camera = this.cameras.get(id);
    if (!camera || !camera.isActive) return null;
    
    // Check if process is a ChildProcess (not a test function)
    const process = camera.process;
    if (process && typeof process === 'object' && 'stdout' in process) {
      return process as ChildProcessWithoutNullStreams;
    }
    
    return null;
  }

  // Start streaming from a camera
  startStream(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    if (camera.isActive && camera.process) {
      // Stream status log disabled - logger.info(`Camera ${cameraId} is already streaming`, 'StreamManager');
      return true;
    }

    // Check if this is a test stream
    if (camera.rtspUrl.startsWith('test://')) {
      logger.info(`Starting test stream for camera ${cameraId}`, 'StreamManager');
      this.startTestStream(cameraId);
      return true;
    }

    try {
      // Construct authentication part of URL if provided
      let rtspUrl = camera.rtspUrl;
      if (camera.username && camera.password) {
        const urlParts = camera.rtspUrl.split("://");
        if (urlParts.length === 2) {
          const encodedUsername = encodeURIComponent(camera.username);
          const encodedPassword = encodeURIComponent(camera.password);
          rtspUrl = `${urlParts[0]}://${encodedUsername}:${encodedPassword}@${urlParts[1]}`;
        }
      }

      // Prepare optimized ffmpeg arguments for the camera stream
      // These settings are tuned for better reliability and performance
      const ffmpegArgs = [
        "-loglevel",
        "debug", // Increased logging for debugging
        // Use TCP for RTSP as it's much more reliable than UDP
        "-rtsp_transport",
        "tcp",
        // Set timeout for connection (10 seconds = 10,000,000 microseconds)
        // Increased from 3s to handle slower networks and initialization
        "-timeout",
        "10000000",

        // Error tolerance flags
        "-err_detect",
        "ignore_err",
        "-fflags",
        "+discardcorrupt",

        // More aggressive keyframe seeking to improve startup
        "-flags",
        "low_delay",
        // Set maximum delay for better synchronization
        "-max_delay",
        "300000",
        // Probing and analysis settings
        // Increased probesize for better compatibility with unreliable streams
        "-probesize",
        "5000000", // 5MB (increased from 64KB for better stream detection)
        // Analyze duration - balance between startup speed and reliability
        "-analyzeduration",
        "3000000", // 3 seconds (increased from 1s for better codec detection)
        "-re", // Force reading input at the native frame rate
        // Set input frame rate to control the stream rate before processing
        "-r",
        "5",
        // Input source
        "-i",
        rtspUrl,
        // Output format as image pipe for streaming
        "-f",
        "mjpeg", // Explicitly set output format to MJPEG
        "-pix_fmt",
        "yuvj420p",
        "-vcodec",
        "mjpeg",
        // Set high quality (lower value = higher quality, range 1-31)
        "-q:v",
        "3",
        // Set output frameRate to 5 FPS to prevent flickering
        "-r",
        "5",
        // Apply scaling and night mode filter if needed
        "-vf",
        camera.nightMode
          ? "scale=854:480,eq=gamma=1.5:contrast=1.2:brightness=0.2"
          : "scale=854:480",
        // Output pipe
        "pipe:1",
      ];

      console.log(`*** CAMERA ${cameraId} STARTING STREAM WITH FRAME RATE: ${camera.frameRate} FPS ***`);
      // FFMPEG command log disabled - logger.info(`Command: ffmpeg ${ffmpegArgs.join(" ")}`, 'StreamManager');

      // Reset retry count on successful connection attempt start
      // Note: Only reset if we've had a successful connection before
      // Keep retry count during connection attempts to track rate limiting

      // Spawn ffmpeg process with proper pipes for more reliable streaming
      const process = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      // FFMPEG process spawn log disabled - logger.info(`FFMPEG process for camera ${cameraId} spawned with PID: ${process.pid}`, 'StreamManager');
      camera.process = process;
      camera.isActive = true;
      camera.lastError = undefined; // Clear any previous errors

      // Add error handling for the process
      process.on("error", (err) => {
        logger.error(`FFMPEG process error for camera ${cameraId}: ${err.message}`, 'StreamManager');
        camera.isActive = false;
      });

      // Create a buffer to accumulate data chunks
      let buffer = Buffer.alloc(0);
      let streamErrors = 0;
      let lastSuccessfulFrame = Date.now();

      // Handle output data
      process.stdout.on("data", (data: Buffer) => {
        // Optimize: Only log frame data in development or on errors
        if ((global as any).process?.env?.NODE_ENV !== 'production' || streamErrors > 5) {

        }
        streamErrors = 0;
        lastSuccessfulFrame = Date.now();

        // Reset retry count on successful frame reception
        // This means camera is working and rate limit (if any) has expired
        if (camera.retryCount > 0) {
          logger.info(`Camera ${cameraId} connection successful, resetting retry count`, 'StreamManager');
          camera.retryCount = 0;
        }

        buffer = Buffer.concat([buffer, data]);

        let startMarkerPos = -1;
        let endMarkerPos = -1;
        let frameCount = 0;

        // Add frame rate limiting to prevent overwhelming the frontend
        // Force to 5 FPS to prevent flickering
        const FRAME_RATE_LIMIT = 5;
        const FRAME_INTERVAL = 1000 / FRAME_RATE_LIMIT; // milliseconds between frames
        if (frameCount === 1) { // Log only for first frame to avoid spam
          console.log(`*** CAMERA ${cameraId} FRAME RATE LIMITING: ${FRAME_RATE_LIMIT} FPS, INTERVAL: ${FRAME_INTERVAL}ms ***`);
        }
        // Use camera object to store last frame sent time to persist between data chunks
        if (camera.lastFrameSentTime === undefined) {
          camera.lastFrameSentTime = Date.now();
        }

        while (
          (startMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd8]))) !== -1 &&
          (endMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd9]), startMarkerPos)) !== -1
        ) {
          const frameBuffer = buffer.slice(startMarkerPos, endMarkerPos + 2);
          camera.lastFrame = frameBuffer;
          frameCount++;

          // Optimize: Only emit if there are clients watching
          const room = this.io.sockets.adapter.rooms.get(`camera-${cameraId}`);
          const clientCount = room ? room.size : 0;

          if (clientCount > 0) {
            const now = Date.now();
            // Only send frame if enough time has passed since the last frame was sent
            if (now - (camera.lastFrameSentTime || 0) >= FRAME_INTERVAL) {
              camera.lastFrameSentTime = now;

              // Only log emission details in development
              if ((global as any).process?.env?.NODE_ENV !== 'production') {
                console.log(`*** CAMERA ${cameraId} EMITTING FRAME: ${frameBuffer.length} bytes to ${clientCount} clients ***`);
              }

              this.io.to(`camera-${cameraId}`).emit("frame", {
              cameraId,
              data: frameBuffer.toString("base64"),
              timestamp: new Date().toISOString(),
              });
            }
          }

          // Motion-triggered detection (non-blocking, async)
          this.processFrameForMotion(cameraId, frameBuffer).catch(error => {
            console.error(`Motion detection error for ${cameraId}:`, error);
          });

          buffer = buffer.slice(endMarkerPos + 2);
        }
        
        if (frameCount > 0) {

        }
      });

      // Enhanced error handling for the process
      let errorLog = "";
      process.stderr.on("data", (data: Buffer) => {
        const errorMsg = data.toString();
        errorLog += errorMsg;

        // Check for specific error types
        if (
          errorMsg.includes("Operation not permitted") ||
          errorMsg.includes("Connection refused") ||
          errorMsg.includes("Unauthorized")
        ) {
          logger.error(
            `RTSP Authentication error for camera ${cameraId}. Check your credentials.`, 'StreamManager',
          );
          // Notify connected clients about the error
          this.io.to(`camera-${cameraId}`).emit("camera-error", {
            cameraId,
            error: "Authentication failed. Please check camera credentials.",
            timestamp: new Date().toISOString(),
          });
          streamErrors++;
        } else if (errorMsg.includes("Connection timed out") || errorMsg.includes("Operation timed out")) {
          logger.error(
            `Connection timeout for camera ${cameraId}. Camera is unreachable. Check the IP address, network connectivity, and camera power.`, 'StreamManager',
          );
          camera.lastError = `Network timeout - Camera unreachable at ${camera.rtspUrl.match(/@([^/]+)/)?.[1] || 'unknown IP'}`;
          this.io.to(`camera-${cameraId}`).emit("camera-error", {
            cameraId,
            error: "Camera unreachable. Check: 1) Camera is powered on, 2) Network cable connected, 3) IP address is correct. Run: bash tmp_rovodev_check_camera_network.sh",
            timestamp: new Date().toISOString(),
            details: {
              type: 'network_timeout',
              suggestion: 'Run network diagnostics: bash tmp_rovodev_check_camera_network.sh'
            }
          });
          streamErrors++;
        } else {
          // For debugging purposes
          // FFMPEG stderr logging disabled - logger.debug(`FFMPEG stderr (${cameraId}): ${errorMsg}`, 'FFMPEG');
        }

        // If we get too many errors, restart the stream
        if (streamErrors > 5 && Date.now() - lastSuccessfulFrame > 10000) {
          logger.warn(
            `Too many errors for camera ${cameraId}, attempting to restart stream`, 'StreamManager',
          );
          this.restartStream(cameraId);
        }
      });

      // Handle process exit with improved retry logic
      process.on("exit", (code: number) => {
        logger.info(
          `FFMPEG process for camera ${cameraId} exited with code ${code}`, 'StreamManager',
        );
        if (camera.isActive) {
          // Process was not intentionally stopped by our stopStream()
          camera.isActive = false; // Mark as inactive as the process is gone
          camera.process = null;

          // Determine if a restart is needed
          let shouldRestart = false;
          if (code !== 0) {
            logger.error(
              `FFMPEG process for camera ${cameraId} exited with error code ${code}. Error log: ${errorLog}`, 'StreamManager',
            );
            // The console.error above already includes the errorLog, so we just log the error code here for the specific message.
            // console.log(`FFMPEG process for camera ${cameraId} exited with error code ${code}.`); // Redundant with the error log above
            shouldRestart = true;
          } else {
            // code === 0, but camera.isActive was true, meaning it wasn't a clean manual stop.
            // This is an unexpected exit, even if with code 0 (e.g. due to stream errors ending FFMPEG)
            logger.warn(
              `FFMPEG process for camera ${cameraId} exited unexpectedly with code 0 while still marked active. Error log: ${errorLog}`, 'StreamManager',
            );
            shouldRestart = true;
          }

          if (shouldRestart) {
            // Calculate retry delay with exponential backoff (5-30 seconds)
            const retryCount = camera.retryCount || 0;
            
            // IMPORTANT: TP-Link Tapo cameras have rate limiting!
            // Max 10 retries, then wait 5 minutes before trying again
            // This prevents IP bans from the camera
            const MAX_RETRIES = 10;
            const COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes
            
            if (retryCount >= MAX_RETRIES) {
              logger.warn(
                `Camera ${cameraId} reached max retry limit (${MAX_RETRIES}). Falling back to test stream.`, 'StreamManager',
              );
              
              camera.retryCount = 0; // Reset for next attempt
              
              // Start test stream instead of going into cooldown
              this.startTestStream(cameraId);
              
              this.io.to(`camera-${cameraId}`).emit("camera-status", {
                cameraId,
                status: "online",
                message: `RTSP connection failed after ${MAX_RETRIES} attempts. Using test stream.`,
                timestamp: new Date().toISOString(),
              });
              
              return;
            }
            
            const retryDelay = Math.min(
              5000 * Math.pow(1.5, retryCount),
              30000,
            );
            camera.retryCount = retryCount + 1;

            logger.info(
              `Attempting to restart stream for camera ${cameraId} in ${retryDelay / 1000} seconds (retry #${camera.retryCount}/${MAX_RETRIES})`, 'StreamManager',
            );

            this.io.to(`camera-${cameraId}`).emit("camera-status", {
              cameraId,
              status: "reconnecting",
              message: `Connection lost (exit code ${code}). Retrying in ${Math.round(retryDelay / 1000)} seconds... (${camera.retryCount}/${MAX_RETRIES})`,
              timestamp: new Date().toISOString(),
            });

            setTimeout(() => this.startStream(cameraId), retryDelay);
          }
        } else {
          // camera.isActive was false, meaning stopStream() was called. This is a clean manual stop.
          // Also log the errorLog here if the exit was not clean (code !=0) even if manually stopped.
          if (code !== 0) {
            logger.error(
              `FFMPEG process for camera ${cameraId} exited with code ${code} after being manually stopped. Error log: ${errorLog}`, 'StreamManager',
            );
          } else {
            logger.info(
              `FFMPEG process for camera ${cameraId} exited (code ${code}) after being manually stopped.`, 'StreamManager',
            );
          }
        }
      });

      // Emit camera status change
      this.io.emit("cameraStatus", { cameraId, status: "online" });

      // Stream started log disabled - logger.info(`Started streaming from camera ${cameraId}`, 'StreamManager');
      return true;
    } catch (error: any) {
      logger.error(`Error starting stream for camera ${cameraId}: ${error.message}`, 'StreamManager');
      camera.isActive = false;
      camera.process = null;
      return false;
    }
  }

  // Stop streaming from a camera
  stopStream(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera || !camera.isActive) return false;

    if (camera.process) {
      if (typeof camera.process === 'object' && 'pid' in camera.process) {
        // Process kill log disabled - logger.info(`Attempting to kill FFMPEG process for camera ${cameraId} (PID: ${camera.process.pid})`, 'StreamManager');
        camera.process.kill('SIGTERM'); // Use SIGTERM for graceful shutdown
        
        // Set a timeout to forcefully kill if SIGTERM doesn't work
        setTimeout(() => {
          if (camera.process && typeof camera.process === 'object' && 'killed' in camera.process && !camera.process.killed) {
            logger.warn(`FFMPEG process for ${cameraId} did not terminate gracefully, sending SIGKILL`, 'StreamManager');
            (camera.process as ChildProcessWithoutNullStreams).kill('SIGKILL');
          }
        }, 5000); // 5 seconds to wait for graceful exit
      }

      camera.isActive = false;
      camera.process = null;
      // Stream stopped log disabled - logger.info(`Stopped streaming from camera ${cameraId}`, 'StreamManager');
      return true;
    }

    return false;
  }

  // Restart a camera stream - useful for recovering from errors
  restartStream(cameraId: string): boolean {
    // Stream restart log disabled - logger.info(`Attempting to restart stream for camera ${cameraId}`, 'StreamManager');

    // First stop the stream
    this.stopStream(cameraId);

    // Wait a brief moment to ensure cleanup
    setTimeout(() => {
      // Then start it again
      const started = this.startStream(cameraId);
      logger.info(
        `Camera ${cameraId} restart ${started ? "successful" : "failed"}`, 'StreamManager',
      );

      // Notify clients of the restart attempt
      this.io.to(`camera-${cameraId}`).emit("camera-status", {
        cameraId,
        status: "restarted",
        timestamp: new Date().toISOString(),
      });
    }, 1000);

    return true;
  }

  // Start a test stream that generates fake frames
  startTestStream(cameraId: string) {
    // Test stream start log disabled - logger.info(`*** STARTING TEST STREAM for camera ${cameraId} ***`, 'StreamManager');
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      logger.error(`Cannot start test stream: Camera ${cameraId} not found`, 'StreamManager');
      return;
    }

    // Stop any existing process
    if (camera.process) {
      if (typeof camera.process === 'object' && 'kill' in camera.process) {
        (camera.process as ChildProcessWithoutNullStreams).kill();
      } else if (typeof camera.process === "function") {
        camera.process();
      }
      camera.process = null;
    }

    // Test stream log disabled - logger.info(`Starting test stream for camera ${cameraId}`, 'StreamManager');
    camera.isActive = true;
    camera.lastError = "Using test stream - RTSP not available";

    // Generate test frames at the specified frame rate
    const interval = setInterval(() => {
      try {
        const testFrame = generateTestJpegFrame(cameraId);
        camera.lastFrame = testFrame;

        // Emit the test frame to all clients subscribed to this camera
        this.io.to(`camera-${cameraId}`).emit("frame", {
          cameraId,
          data: testFrame.toString("base64"),
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Camera ${cameraId}: Emitted test frame of size ${testFrame.length} bytes`, 'StreamManager',
        );
      } catch (error: unknown) {
        logger.error(
          `Error generating test frame for camera ${cameraId}: ${(error as Error).message}`, 'StreamManager',
        );
        clearInterval(interval);
        camera.isActive = false;
      }
    }, 1000 / camera.frameRate);

    // Store the interval so we can clear it later
    camera.process = () => clearInterval(interval);
  }

  // Update camera settings
  updateCamera(cameraId: string, updates: Partial<Camera>): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    // Apply updates
    Object.assign(camera, updates);

    // Restart stream if it was active and certain settings changed
    const needsRestart =
      updates.rtspUrl || updates.resolution || updates.frameRate;
    if (needsRestart && camera.isActive) {
      this.stopStream(cameraId);
      this.startTestStream(cameraId);
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
      logger.error(`Cannot take snapshot: Camera ${cameraId} not found`, 'StreamManager');
      return null;
    }

    const frame = camera.lastFrame;
    if (!frame) {
      logger.warn(`No frame available for snapshot for camera ${cameraId}`, 'StreamManager');
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `snapshot_${cameraId}_${timestamp}.jpg`;
      const filepath = path.join(snapshotsDir, filename);

      // Save the current frame as a snapshot
      fs.writeFileSync(filepath, frame);
      // Snapshot save log disabled - logger.info(`Snapshot saved: ${filepath}`, 'StreamManager');

      return `/snapshots/${filename}`;
    } catch (error: any) {
      logger.error(`Error saving snapshot for camera ${cameraId}: ${error.message}`, 'StreamManager');
      return null;
    }
  }

  // Get last frame for a camera
  getLastFrame(cameraId: string): Buffer | null {
    const camera = this.cameras.get(cameraId);
    return camera ? camera.lastFrame : null;
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
        `Auto-starting RTSP stream for camera: ${camera.id} (${camera.name})`,
      );
      streamManager.startStream(camera.id);
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
