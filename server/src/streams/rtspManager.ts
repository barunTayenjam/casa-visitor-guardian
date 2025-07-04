import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { generateTestJpegFrame } from "../utils/testImageGenerator.js";
import { logger } from "../utils/logger.js";

// Import ffmpeg-static safely
// @ts-expect-error - Ignore type checking for ffmpeg-static import
import ffmpegStatic from "ffmpeg-static";
const ffmpegPath = ffmpegStatic as unknown as string;

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure snapshots and events directories exist
const snapshotsDir = path.join(__dirname, "../../public/snapshots");
const eventsDir = path.join(__dirname, "../../public/events");

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
interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  process: ChildProcessWithoutNullStreams | null; // Using any type to avoid TypeScript issues with process types
  isActive: boolean;
  lastFrame: Buffer | null;
  frameRate: number;
  resolution: string;
  nightMode: boolean;
  retryCount?: number; // Track connection retry attempts
  lastError?: string; // Store the last error message
}

// Default camera configuration - for demo purposes
const defaultCameras: Omit<Camera, "process" | "isActive" | "lastFrame">[] = [
  {
    id: "cam1",
    name: "Front Door",
    // The URL format that works in VLC should work here too with proper parameters
    rtspUrl: "rtsp://192.168.31.62:554/stream1",
    username: "barun.2009.tam@gmail.com",
    password: "mezmu2-xewwyn-geJtiv",
    frameRate: 15, // Slightly higher framerate for better quality
    resolution: "2560x1440", // Using camera's native resolution without scaling down
    nightMode: false,
    retryCount: 0, // Reset retry count
  },
  {
    id: "cam2",
    name: "Front Door",
    // The URL format that works in VLC should work here too with proper parameters
    rtspUrl: "rtsp://192.168.31.61:554/stream1",
    username: "barun.2009.tam@gmail.com",
    password: "mezmu2-xewwyn-geJtiv",
    frameRate: 15, // Slightly higher framerate for better quality
    resolution: "2560x1440", // Using camera's native resolution without scaling down
    nightMode: false,
    retryCount: 0, // Reset retry count
  },
];

// Camera manager
export class StreamManager {
  cameras: Map<string, Camera>;
  io: SocketIOServer;
  frameInterval: number;

  constructor(io: SocketIOServer) {
    this.cameras = new Map();
    this.io = io;
    this.frameInterval = 40; // ~25 FPS default interval for sending frames

    // Initialize default cameras
    defaultCameras.forEach((camera) => {
      this.addCamera(camera);
    });
  }

  // Add a camera to the manager
  addCamera(
    cameraConfig: Omit<Camera, "process" | "isActive" | "lastFrame">,
  ): string {
    const camera: Camera = {
      ...cameraConfig,
      process: null,
      isActive: false,
      lastFrame: null,
    };
    this.cameras.set(camera.id, camera);
    logger.info(`Added camera: ${camera.id} (${camera.name})`, 'StreamManager');
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

  // Start streaming from a camera
  startStream(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;

    if (camera.isActive && camera.process) {
      logger.info(`Camera ${cameraId} is already streaming`, 'StreamManager');
      return true;
    }

    try {
      // Construct authentication part of URL if provided
      let rtspUrl = camera.rtspUrl;
      if (camera.username && camera.password) {
        const urlParts = camera.rtspUrl.split("://");
        if (urlParts.length === 2) {
          rtspUrl = `${urlParts[0]}://${camera.username}:${camera.password}@${urlParts[1]}`;
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
        // Set a shorter timeout to detect connection issues quickly
        "-timeout",
        "3000000",

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
        // Reduce probing size for faster startup
        "-probesize",
        "64000",
        // Analyze shorter portions of the input to speed up startup
        "-analyzeduration",
        "1000000",
        "-re", // Force reading input at the native frame rate
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
        // Set frameRate to match camera settings
        "-r",
        camera.frameRate.toString(),
        // Apply scaling and night mode filter if needed
        "-vf",
        camera.nightMode
          ? "scale=854:480,eq=gamma=1.5:contrast=1.2:brightness=0.2"
          : "scale=854:480",
        // Output pipe
        "pipe:1",
      ];

      logger.info(`Starting stream for camera ${cameraId} with resolution ${camera.resolution}`, 'StreamManager');
      logger.info(`Command: ffmpeg ${ffmpegArgs.join(" ")}`, 'StreamManager');

      // Reset retry count if camera is restarting after being offline for a while
      if (camera.retryCount && camera.retryCount > 5) {
        camera.retryCount = 0;
      }

      // Spawn ffmpeg process with proper pipes for more reliable streaming
      const process = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      logger.info(`FFMPEG process for camera ${cameraId} spawned with PID: ${process.pid}`, 'StreamManager');
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
        console.log(`*** CAMERA ${cameraId} FRAME DATA: Received ${data.length} bytes ***`);
        streamErrors = 0;
        lastSuccessfulFrame = Date.now();

        buffer = Buffer.concat([buffer, data]);

        let startMarkerPos = -1;
        let endMarkerPos = -1;
        let frameCount = 0;

        while (
          (startMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd8]))) !== -1 &&
          (endMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd9]), startMarkerPos)) !== -1
        ) {
          const frameBuffer = buffer.slice(startMarkerPos, endMarkerPos + 2);
          camera.lastFrame = frameBuffer;
          frameCount++;

          console.log(`*** CAMERA ${cameraId} EMITTING FRAME: ${frameBuffer.length} bytes to room camera-${cameraId} ***`);
          
          // Get the number of clients in the room
          const room = this.io.sockets.adapter.rooms.get(`camera-${cameraId}`);
          const clientCount = room ? room.size : 0;
          console.log(`*** CAMERA ${cameraId} ROOM HAS ${clientCount} CLIENTS ***`);

          this.io.to(`camera-${cameraId}`).emit("frame", {
            cameraId,
            data: frameBuffer.toString("base64"),
            timestamp: new Date().toISOString(),
          });

          buffer = buffer.slice(endMarkerPos + 2);
        }
        
        if (frameCount > 0) {
          console.log(`*** CAMERA ${cameraId} PROCESSED ${frameCount} FRAMES ***`);
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
        } else if (errorMsg.includes("Connection timed out")) {
          logger.error(
            `Connection timeout for camera ${cameraId}. Check the IP address and network.`, 'StreamManager',
          );
          this.io.to(`camera-${cameraId}`).emit("camera-error", {
            cameraId,
            error: "Connection timed out. Check camera IP and network.",
            timestamp: new Date().toISOString(),
          });
          streamErrors++;
        } else {
          // For debugging purposes
          logger.debug(`FFMPEG stderr (${cameraId}): ${errorMsg}`, 'FFMPEG');
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
            const retryDelay = Math.min(
              5000 * Math.pow(1.5, retryCount),
              30000,
            );
            camera.retryCount = retryCount + 1;

            logger.info(
              `Attempting to restart stream for camera ${cameraId} in ${retryDelay / 1000} seconds (retry #${camera.retryCount})`, 'StreamManager',
            );

            this.io.to(`camera-${cameraId}`).emit("camera-status", {
              cameraId,
              status: "reconnecting",
              message: `Connection lost (exit code ${code}). Retrying in ${Math.round(retryDelay / 1000)} seconds...`,
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

      logger.info(`Started streaming from camera ${cameraId}`, 'StreamManager');
      return true;
    } catch (error) {
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
      logger.info(`Attempting to kill FFMPEG process for camera ${cameraId} (PID: ${camera.process.pid})`, 'StreamManager');
      camera.process.kill('SIGTERM'); // Use SIGTERM for graceful shutdown
      
      // Set a timeout to forcefully kill if SIGTERM doesn't work
      setTimeout(() => {
        if (camera.process && !camera.process.killed) {
          logger.warn(`FFMPEG process for ${cameraId} did not terminate gracefully, sending SIGKILL`, 'StreamManager');
          camera.process.kill('SIGKILL');
        }
      }, 5000); // 5 seconds to wait for graceful exit

      camera.isActive = false;
      camera.process = null;
      logger.info(`Stopped streaming from camera ${cameraId}`, 'StreamManager');
      return true;
    }

    return false;
  }

  // Restart a camera stream - useful for recovering from errors
  restartStream(cameraId: string): boolean {
    logger.info(`Attempting to restart stream for camera ${cameraId}`, 'StreamManager');

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
    logger.info(`*** STARTING TEST STREAM for camera ${cameraId} ***`, 'StreamManager');
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      logger.error(`Cannot start test stream: Camera ${cameraId} not found`, 'StreamManager');
      return;
    }

    // Stop any existing process
    if (camera.process) {
      if (typeof camera.process.kill === "function") {
        camera.process.kill();
      } else if (typeof camera.process === "function") {
        camera.process();
      }
      camera.process = null;
    }

    logger.info(`Starting test stream for camera ${cameraId}`, 'StreamManager');
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
      } catch (error) {
        logger.error(
          `Error generating test frame for camera ${cameraId}: ${error.message}`, 'StreamManager',
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
      logger.info(`Snapshot saved: ${filepath}`, 'StreamManager');

      return `/snapshots/${filename}`;
    } catch (error) {
      logger.error(`Error saving snapshot for camera ${cameraId}: ${error.message}`, 'StreamManager');
      return null;
    }
  }

  // Get last frame for a camera
  getLastFrame(cameraId: string): Buffer | null {
    const camera = this.cameras.get(cameraId);
    return camera ? camera.lastFrame : null;
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

  // Simulate motion detection
  simulateMotionDetection(cameraId: string) {
    const camera = this.cameras.get(cameraId);
    if (!camera || !camera.isActive) return;

    logger.info(`Simulating motion detection for camera ${cameraId}`, 'StreamManager');

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

// Setup and return the stream manager
export async function setupRTSPStreams(
  io: SocketIOServer,
): Promise<StreamManager> {
  console.log("Setting up RTSP stream manager");
  const streamManager = new StreamManager(io);

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
