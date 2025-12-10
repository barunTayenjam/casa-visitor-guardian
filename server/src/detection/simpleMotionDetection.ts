import { Server as SocketIOServer } from 'socket.io';
import { StreamManager } from '../streams/rtspManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Import ffmpeg-static safely

import ffmpegStatic from 'ffmpeg-static';
const ffmpegPath = ffmpegStatic as unknown as string;

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure events directory exists
const eventsDir = path.join(__dirname, '../../public/events');
if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
}

// Motion detection settings interface
interface MotionSettings {
  enabled: boolean;
  sensitivity: number; // 0-100, lower = more sensitive
  cooldownPeriod: number; // milliseconds
}

// Store motion settings for each camera
const cameraSettings = new Map<string, MotionSettings>();

// Store last event time for each camera
const lastEventTimes = new Map<string, number>();

// Store last frames for each camera for comparison
const previousFrames = new Map<string, Buffer>();

// Simple motion detection manager
export class SimpleMotionDetector {
  private streamManager: StreamManager;
  private io: SocketIOServer;
  private detectionInterval: NodeJS.Timeout | null = null;

  constructor(streamManager: StreamManager, io: SocketIOServer) {
    this.streamManager = streamManager;
    this.io = io;
    
    // Initialize default settings for all cameras
    this.streamManager.getAllCameras().forEach(camera => {
      this.setDefaultSettings(camera.id);
    });
  }

  // Set default motion detection settings for a camera
  setDefaultSettings(cameraId: string): void {
    cameraSettings.set(cameraId, {
      enabled: true,
      sensitivity: 25, // Default sensitivity
      cooldownPeriod: 10000 // 10 seconds between events
    });
  }

  // Get motion detection settings for a camera
  getSettings(cameraId: string): MotionSettings | null {
    return cameraSettings.get(cameraId) || null;
  }

  // Update motion detection settings for a camera
  updateSettings(cameraId: string, settings: Partial<MotionSettings>): boolean {
    const currentSettings = cameraSettings.get(cameraId);
    if (!currentSettings) {
      return false;
    }

    // Update settings
    Object.assign(currentSettings, settings);
    return true;
  }

  // Start motion detection
  start(): void {
    if (this.detectionInterval) {
      return;
    }

    // Run motion detection every 500ms
    this.detectionInterval = setInterval(() => {
      this.detectMotionOnAllCameras();
    }, 500);

    console.log('Simple motion detection started');
  }

  // Stop motion detection
  stop(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      console.log('Motion detection stopped');
    }
  }

  // Process all active cameras for motion
  private async detectMotionOnAllCameras(): Promise<void> {
    const cameras = this.streamManager.getAllCameras();
    for (const camera of cameras) {
      if (camera.isActive) {
        await this.detectMotionOnCamera(camera.id);
      }
    }
  }

  // Process a single camera for motion detection
  private async detectMotionOnCamera(cameraId: string): Promise<void> {
    const settings = cameraSettings.get(cameraId);
    if (!settings || !settings.enabled) {
      return;
    }

    // Get the last frame for the camera
    const currentFrame = this.streamManager.getLastFrame(cameraId);
    if (!currentFrame) {
      return;
    }

    // Skip if in cooldown period
    const now = Date.now();
    const lastEvent = lastEventTimes.get(cameraId) || 0;
    if (now - lastEvent < settings.cooldownPeriod) {
      return;
    }

    // If this is the first frame, store it and return
    if (!previousFrames.has(cameraId)) {
      previousFrames.set(cameraId, currentFrame);
      return;
    }

    try {
      // Simple frame comparison - this compares sizes as a very basic check
      // In a real implementation, we would do pixel-by-pixel comparison
      const prevFrame = previousFrames.get(cameraId)!;
      const sizeDiff = Math.abs(currentFrame.length - prevFrame.length);
      
      // Update previous frame for next comparison
      previousFrames.set(cameraId, currentFrame);
      
      // If difference is significant, trigger motion detected event
      // This is a very basic implementation - a real one would do more sophisticated analysis
      if (sizeDiff > (10000 - (settings.sensitivity * 100))) {
        // Update last event time
        lastEventTimes.set(cameraId, now);
        
        // Save the event image
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `motion_${cameraId}_${timestamp}.jpg`;
        const filepath = path.join(eventsDir, filename);
        
        // Write the current frame to a file
        try {
          // Validate that currentFrame is valid JPEG data
          if (!currentFrame || currentFrame.length === 0) {
            console.warn(`Motion detected for ${cameraId} but no valid frame data available`);
            return;
          }
          
          // Check if the frame starts with JPEG header (0xFF 0xD8)
          if (currentFrame[0] !== 0xFF || currentFrame[1] !== 0xD8) {
            console.warn(`Motion detected for ${cameraId} but frame data is not valid JPEG format`);
            return;
          }
          
          fs.writeFileSync(filepath, currentFrame);
          console.log(`Motion event image saved: ${filepath} (${currentFrame.length} bytes)`);
        } catch (error) {
          console.error(`Failed to save motion event image for ${cameraId}:`, error);
          return;
        }
        
        // Calculate motion confidence based on size difference
        const confidence = Math.min(100, Math.round((sizeDiff / 10000) * 100));
        
        // Create motion event only if image was successfully saved
        const event = {
          id: `evt_${filename}`,
          cameraId,
          timestamp: new Date().toISOString(),
          imagePath: `/events/${filename}`,
          confidence,
          duration: 0 // Will be updated when motion stops
        };
        
        // Emit event to clients
        this.io.emit('motionDetected', event);
        
        // Take a high-resolution snapshot
        try {
          const snapshotPath = await this.streamManager.takeSnapshot(cameraId);
          if (snapshotPath) {
            // Emit snapshot event
            this.io.emit('motionSnapshot', {
              eventId: event.id,
              snapshotPath
            });
          }
        } catch (error) {
          // Snapshot error log disabled - console.error('Error taking snapshot:', error);
        }
        
        // Motion detection log disabled - console.log(`Motion detected on camera ${cameraId} with confidence ${confidence}%`);
      }
    } catch (error) {
      // Motion detection error log disabled - console.error(`Error in motion detection for camera ${cameraId}:`, error);
    }
  }
}

// Create and start motion detection
export function setupSimpleMotionDetection(streamManager: StreamManager, io: SocketIOServer): SimpleMotionDetector {
  const motionDetector = new SimpleMotionDetector(streamManager, io);
  motionDetector.start();
  
  // Make available globally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).motionDetector = motionDetector;
  
  return motionDetector;
}

// Global getter function
export function getMotionDetector(): SimpleMotionDetector {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (global as any).motionDetector;
}
