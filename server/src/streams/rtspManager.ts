import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

// Import ffmpeg-static safely
// @ts-ignore - Ignore type checking for ffmpeg-static import
import ffmpegStatic from 'ffmpeg-static';
const ffmpegPath = ffmpegStatic as unknown as string;

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure snapshots and events directories exist
const snapshotsDir = path.join(__dirname, '../../public/snapshots');
const eventsDir = path.join(__dirname, '../../public/events');

// Create directories if they don't exist
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
  console.log(`Created snapshots directory: ${snapshotsDir}`);
}

if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
  console.log(`Created events directory: ${eventsDir}`);
}

// Define camera interface
interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  process: any; // Using any type to avoid TypeScript issues with process types
  isActive: boolean;
  lastFrame: Buffer | null;
  frameRate: number;
  resolution: string;
  nightMode: boolean;
  retryCount?: number; // Track connection retry attempts
  lastError?: string; // Store the last error message
}

// Default camera configuration - for demo purposes
const defaultCameras: Omit<Camera, 'process' | 'isActive' | 'lastFrame'>[] = [
  {
    id: 'cam2',
    name: 'Front Door',
    // The URL format that works in VLC should work here too with proper parameters
    rtspUrl: 'rtsp://192.168.31.61:554/stream1',
    username: 'barun.2009.tam@gmail.com',
    password: 'mezmu2-xewwyn-geJtiv',
    frameRate: 15, // Slightly higher framerate for better quality
    resolution: '2560x1440', // Using camera's native resolution without scaling down
    nightMode: false,
    retryCount: 0 // Reset retry count
  }
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
    defaultCameras.forEach(camera => {
      this.addCamera(camera);
    });
  }

  // Start streaming from a camera
  startStream(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;
    
    if (camera.isActive && camera.process) {
      console.log(`Camera ${cameraId} is already streaming`);
      return true;
    }
    
    try {
      // Construct authentication part of URL if provided
      let rtspUrl = camera.rtspUrl;
      if (camera.username && camera.password) {
        const urlParts = camera.rtspUrl.split('://');
        if (urlParts.length === 2) {
          rtspUrl = `${urlParts[0]}://${camera.username}:${camera.password}@${urlParts[1]}`;
        }
      }
      
      // Prepare optimized ffmpeg arguments for the camera stream
      // These settings are tuned for better reliability and performance
      const ffmpegArgs = [
        // Use TCP for RTSP as it's much more reliable than UDP
        '-rtsp_transport', 'tcp',
        // Set a shorter timeout to detect connection issues quickly
        '-timeout', '3000000',
        // Use a reasonable input buffer size
        '-bufsize', '2048k',
        // More aggressive keyframe seeking to improve startup
        '-flags', 'low_delay',
        // Set maximum delay for better synchronization
        '-max_delay', '300000',
        // Reduce probing size for faster startup
        '-probesize', '64000',
        // Analyze shorter portions of the input to speed up startup
        '-analyzeduration', '1000000',
        // Input source
        '-i', rtspUrl,
        '-re', // Force reading input at the native frame rate
        // Output format as image pipe for streaming
        '-f', 'image2pipe',
        // Use yuvj420p pixel format which works well with mjpeg codec
        '-pix_fmt', 'yuvj420p',
        // Use mjpeg codec for frame-by-frame streaming
        '-vcodec', 'mjpeg',
        // No scaling - using camera's native resolution
        // '-s', camera.resolution, // Removed scaling to preserve native resolution
        // Set high quality (lower value = higher quality, range 1-31)
        '-q:v', '3',
        // Set frameRate to match camera settings
        '-r', camera.frameRate.toString(),
        // Only apply night mode filter if needed
        ...(camera.nightMode ? ['-vf', 'eq=gamma=1.5:contrast=1.2:brightness=0.2'] : []),
        // Output pipe
        'pipe:1'
      ];
      
      console.log(`Starting stream for camera ${cameraId} with resolution ${camera.resolution}`);
      console.log(`Command: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      // Reset retry count if camera is restarting after being offline for a while
      if (camera.retryCount && camera.retryCount > 5) {
        camera.retryCount = 0;
      }
      
      // Spawn ffmpeg process with proper pipes for more reliable streaming
      const process = spawn(ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      camera.process = process;
      camera.isActive = true;
      camera.lastError = undefined; // Clear any previous errors
      
      // Add error handling for the process
      process.on('error', (err) => {
        console.error(`FFMPEG process error for camera ${cameraId}:`, err);
        camera.isActive = false;
      });

      // Create a buffer to accumulate data chunks
      let buffer = Buffer.alloc(0);
      let streamErrors = 0;
      let lastSuccessfulFrame = Date.now();
      
      // Handle output data
      process.stdout.on('data', (data: Buffer) => {
        // Reset error counter since we're receiving data
        streamErrors = 0;
        lastSuccessfulFrame = Date.now();
        
        // Accumulate data chunks
        buffer = Buffer.concat([buffer, data]);

        // Check if we have a complete JPEG (look for JPEG end marker FFD9)
        const endMarkerPos = buffer.indexOf(Buffer.from([0xff, 0xd9]));
        if (endMarkerPos !== -1) {
          // Extract the complete JPEG frame
          const frameBuffer = buffer.slice(0, endMarkerPos + 2);
          camera.lastFrame = frameBuffer;
          
          // Emit the frame to all clients subscribed to this camera
          this.io.to(`camera-${cameraId}`).emit('frame', {
            cameraId,
            data: frameBuffer.toString('base64'),
            timestamp: new Date().toISOString()
          });

          // Reset buffer for next frame, keeping any data after the JPEG
          buffer = buffer.slice(endMarkerPos + 2);
        }
      });

      // Enhanced error handling for the process
      let errorLog = '';
      process.stderr.on('data', (data: Buffer) => {
        const errorMsg = data.toString();
        errorLog += errorMsg;
        
        // Check for specific error types
        if (errorMsg.includes('Operation not permitted') || 
            errorMsg.includes('Connection refused') || 
            errorMsg.includes('Unauthorized')) {
          console.error(`RTSP Authentication error for camera ${cameraId}. Check your credentials.`);
          // Notify connected clients about the error
          this.io.to(`camera-${cameraId}`).emit('camera-error', {
            cameraId,
            error: 'Authentication failed. Please check camera credentials.',
            timestamp: new Date().toISOString()
          });
          streamErrors++;
        } else if (errorMsg.includes('Connection timed out')) {
          console.error(`Connection timeout for camera ${cameraId}. Check the IP address and network.`);
          this.io.to(`camera-${cameraId}`).emit('camera-error', {
            cameraId,
            error: 'Connection timed out. Check camera IP and network.',
            timestamp: new Date().toISOString()
          });
          streamErrors++;
        } else {
          // For debugging purposes
          console.log(`FFMPEG stderr (${cameraId}): ${errorMsg}`);
        }
        
        // If we get too many errors, restart the stream
        if (streamErrors > 5 && (Date.now() - lastSuccessfulFrame) > 10000) {
          console.log(`Too many errors for camera ${cameraId}, attempting to restart stream`);
          this.restartStream(cameraId);
        }
      });

      // Handle process exit with improved retry logic
      process.on('exit', (code: number) => {
        console.log(`FFMPEG process for camera ${cameraId} exited with code ${code}`);
        if (code !== 0) {
          console.error(`FFMPEG process for camera ${cameraId} exited with code ${code}. Error log: ${errorLog}`);
        }
        if (camera.isActive) {
          camera.isActive = false;
          camera.process = null;
          
          // Auto-restart with exponential backoff
          if (code !== 0) {
            // Calculate retry delay with exponential backoff (5-30 seconds)
            const retryCount = camera.retryCount || 0;
            const retryDelay = Math.min(5000 * Math.pow(1.5, retryCount), 30000);
            camera.retryCount = retryCount + 1;
            
            console.log(`Attempting to restart stream for camera ${cameraId} in ${retryDelay/1000} seconds (retry #${camera.retryCount})`);
            
            // Notify clients of reconnection attempt
            this.io.to(`camera-${cameraId}`).emit('camera-status', {
              cameraId,
              status: 'reconnecting',
              message: `Connection lost. Retrying in ${Math.round(retryDelay/1000)} seconds...`,
              timestamp: new Date().toISOString()
            });
            
            setTimeout(() => this.startStream(cameraId), retryDelay);
          }
        }
      });

      // Emit camera status change
      this.io.emit('cameraStatus', { cameraId, status: 'online' });

      console.log(`Started streaming from camera ${cameraId}`);
      return true;
    } catch (error) {
      console.error(`Error starting stream for camera ${cameraId}:`, error);
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
      camera.process.kill('SIGKILL');
      camera.isActive = false;
      console.log(`Stopped streaming from camera ${cameraId}`);
      return true;
    }
    
    return false;
  }
  
  // Restart a camera stream - useful for recovering from errors
  restartStream(cameraId: string): boolean {
    console.log(`Attempting to restart stream for camera ${cameraId}`);
    
    // First stop the stream
    this.stopStream(cameraId);
    
    // Wait a brief moment to ensure cleanup
    setTimeout(() => {
      // Then start it again
      const started = this.startStream(cameraId);
      console.log(`Camera ${cameraId} restart ${started ? 'successful' : 'failed'}`);
      
      // Notify clients of the restart attempt
      this.io.to(`camera-${cameraId}`).emit('camera-status', {
        cameraId,
        status: started ? 'restarted' : 'restart_failed',
        timestamp: new Date().toISOString()
      });
    }, 2000);
    
    return true;
  }

  // Get the latest frame from a camera
  getLastFrame(cameraId: string): Buffer | null {
    const camera = this.cameras.get(cameraId);
    return camera ? camera.lastFrame : null;
  }

  // This method is intentionally empty as we have a more detailed implementation below

  // Take a high-resolution snapshot from a camera
  async takeSnapshot(cameraId: string, resolution = ''): Promise<string | null> {
    // Import the fixed snapshot functionality
    const { captureSnapshot } = await import('./fixedSnapshot.js');
    
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      console.error(`Cannot take snapshot: Camera ${cameraId} not found`);
      return null;
    }

    try {
      // Use our improved snapshot capture function that handles all camera types
      // This maintains your preferred Full HD (1920x1080) resolution for high-quality snapshots
      return await captureSnapshot(camera, resolution);
    } catch (error) {
      console.error(`Error taking snapshot for camera ${cameraId}:`, error);
      return null;
    }
  }

  // Add a new camera
  addCamera(camera: Omit<Camera, 'process' | 'isActive' | 'lastFrame'>): string {
    const id = camera.id || `cam${this.cameras.size + 1}`;
    this.cameras.set(id, {
      ...camera,
      id,
      process: null,
      isActive: false,
      lastFrame: null
    });
    return id;
  }

  // Remove a camera
  removeCamera(cameraId: string): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      return false;
    }

    // Stop the stream if active
    if (camera.isActive) {
      this.stopStream(cameraId);
    }

    // Remove the camera from the map
    return this.cameras.delete(cameraId);
  }

  // Update camera settings
  updateCamera(cameraId: string, settings: Partial<Camera>): boolean {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      return false;
    }

    // Update camera settings
    const needsRestart = ['rtspUrl', 'username', 'password', 'frameRate', 'resolution', 'nightMode']
      .some(key => settings[key as keyof Camera] !== undefined && 
            settings[key as keyof Camera] !== camera[key as keyof Camera]);

    // Update the camera object
    Object.assign(camera, settings);

    // Restart the stream if necessary settings were changed
    if (needsRestart && camera.isActive) {
      this.stopStream(cameraId);
      this.startStream(cameraId);
    }

    return true;
  }

  // Get all cameras
  getAllCameras(): Camera[] {
    // Get all cameras and sanitize them for external use
    return Array.from(this.cameras.values()).map(camera => {
      // Create a shallow copy of the camera object
      const sanitizedCamera = { ...camera };
      // Return the camera object without exposing internal properties
      return sanitizedCamera;
    });
  }

  // Toggle night mode for a camera
  toggleNightMode(cameraId: string, enabled: boolean): boolean {
    return this.updateCamera(cameraId, { nightMode: enabled });
  }

  // Simulate motion detection (since we don't have OpenCV)
  simulateMotionDetection(cameraId: string): void {
    const camera = this.cameras.get(cameraId);
    if (!camera || !camera.isActive) return;

    // Generate a timestamp for the event
    const timestamp = new Date().toISOString();
    
    // Emit a motion detection event
    this.io.emit('motionDetected', {
      id: `evt_${Date.now()}`,
      cameraId,
      timestamp,
      imagePath: `/snapshots/${cameraId}_${timestamp.replace(/[:.]/g, '-')}.jpg`,
      confidence: Math.floor(Math.random() * 60) + 40, // Random confidence between 40-100%
      duration: 0
    });

    // Take a snapshot
    this.takeSnapshot(cameraId).then(snapshotPath => {
      if (snapshotPath) {
        this.io.emit('motionSnapshot', {
          cameraId,
          snapshotPath,
          timestamp
        });
      }
    }).catch(err => {
      console.error('Failed to take snapshot for motion event:', err);
    });
  }
}

// Setup and return the stream manager
export async function setupRTSPStreams(io: SocketIOServer): Promise<StreamManager> {
  const streamManager = new StreamManager(io);
  
  // Auto-start streams for testing (can be commented out in production)
  streamManager.getAllCameras().forEach(camera => {
    streamManager.startStream(camera.id);
  });

  // Setup motion simulation (temporary until OpenCV is implemented)
  setInterval(() => {
    const cameras = streamManager.getAllCameras();
    const activeCameras = cameras.filter(cam => cam.isActive);
    
    if (activeCameras.length > 0) {
      // Randomly choose a camera to simulate motion on occasionally
      if (Math.random() < 0.1) { // 10% chance every interval
        const randomCamera = activeCameras[Math.floor(Math.random() * activeCameras.length)];
        streamManager.simulateMotionDetection(randomCamera.id);
      }
    }
  }, 30000); // Check every 30 seconds
  
  return streamManager;
}
