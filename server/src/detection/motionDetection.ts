import { Server as SocketIOServer } from 'socket.io';
import cv from 'opencv4nodejs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { StreamManager } from '../streams/rtspManager.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure events directory exists
const eventsDir = path.join(__dirname, '../../public/events');
if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
}

// Define events interface
interface MotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  boundingBoxes?: { x: number; y: number; width: number; height: number }[];
  type: 'motion' | 'person';
}

// Motion detection settings
interface MotionSettings {
  enabled: boolean;
  sensitivity: number; // 0-100
  minArea: number;
  cooldownPeriod: number; // milliseconds
  ignoredZones: { x: number; y: number; width: number; height: number }[];
}

// Motion detection class
class MotionDetector {
  streamManager: StreamManager;
  io: SocketIOServer;
  settings: Map<string, MotionSettings>;
  previousFrames: Map<string, cv.Mat>;
  lastEvents: Map<string, number>; // Last event timestamp per camera
  events: MotionEvent[]; // Store recent events
  detectionInterval: NodeJS.Timeout | null;
  hog: cv.HOGDescriptor;

  constructor(streamManager: StreamManager, io: SocketIOServer) {
    this.streamManager = streamManager;
    this.io = io;
    this.settings = new Map();
    this.previousFrames = new Map();
    this.lastEvents = new Map();
    this.events = [];
    this.detectionInterval = null;

    // Initialize HOG descriptor for person detection
    this.hog = new cv.HOGDescriptor();
    this.hog.setSVMDetector(cv.HOGDescriptor.getDefaultPeopleDetector());

    // Initialize default settings for all cameras
    this.streamManager.getAllCameras().forEach(camera => {
      this.settings.set(camera.id, {
        enabled: true,
        sensitivity: 25, // Default sensitivity
        minArea: 500,    // Minimum contour area to trigger detection
        cooldownPeriod: 10000, // 10 seconds between events
        ignoredZones: []
      });
    });
  }

  // Start motion detection
  start() {
    if (this.detectionInterval) {
      return;
    }

    // Run motion detection every 500ms
    this.detectionInterval = setInterval(() => {
      this.detectMotionOnAllCameras();
    }, 2000);

    console.log('Motion and person detection started');
  }

  // Stop motion detection
  stop() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      console.log('Motion and person detection stopped');
    }
  }

  // Process a single camera for motion
  async detectMotionOnCamera(cameraId: string) {
    const settings = this.settings.get(cameraId);
    if (!settings || !settings.enabled) {
      return;
    }

    const currentFrame = this.streamManager.getLastFrame(cameraId);
    if (!currentFrame) {
      return;
    }

    try {
      // Convert buffer to OpenCV Mat
      const img = cv.imdecode(currentFrame);
      const visualizationImg = img.copy();
      let motionDetected = false;
      
      // Convert to grayscale for motion detection
      const gray = img.cvtColor(cv.COLOR_BGR2GRAY);
      
      // Apply Gaussian blur to reduce noise
      const blurred = gray.gaussianBlur(new cv.Size(21, 21), 0);
      
      // If this is the first frame, store it and return
      if (!this.previousFrames.has(cameraId)) {
        this.previousFrames.set(cameraId, blurred);
        return;
      }
      
      // Calculate absolute difference between current and previous frame
      const previousFrame = this.previousFrames.get(cameraId)!;
      const frameDelta = previousFrame.absdiff(blurred);
      
      // Apply threshold to highlight regions with motion
      const threshold = frameDelta.threshold(
        settings.sensitivity, // Lower values = more sensitive
        255,
        cv.THRESH_BINARY
      );
      
      // Dilate the thresholded image to fill in holes
      const dilated = threshold.dilate(
        cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)),
        new cv.Point(-1, -1),
        2
      );
      
      // Find contours on the dilated image
      const contours = dilated.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Store current frame as previous for next iteration
      this.previousFrames.set(cameraId, blurred);
      
      // Check if we should process motion based on cooldown
      const now = Date.now();
      const lastEvent = this.lastEvents.get(cameraId) || 0;
      if (now - lastEvent < settings.cooldownPeriod) {
        return;
      }
      
      // Filter contours by size and check ignored zones
      const significantContours = contours.filter(contour => {
        const area = contour.area;
        if (area < settings.minArea) {
          return false;
        }
        
        // Get bounding rectangle of contour
        const rect = contour.boundingRect();
        
        // Check if the contour is in an ignored zone
        for (const zone of settings.ignoredZones) {
          const zoneRect = new cv.Rect(zone.x, zone.y, zone.width, zone.height);
          const intersection = rect.and(zoneRect);
          
          // If intersection area is more than 50% of contour, ignore it
          if (intersection.area > (rect.area * 0.5)) {
            return false;
          }
        }
        
        return true;
      });
      
      // If we have significant motion, trigger an event
      if (significantContours.length > 0) {
        motionDetected = true;
        // Update last event time
        this.lastEvents.set(cameraId, now);
        
        // Create bounding boxes for visualization
        const boundingBoxes = significantContours.map(contour => {
          const rect = contour.boundingRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          };
        });
        
        // Draw bounding boxes on the image for visualization
        for (const box of boundingBoxes) {
          visualizationImg.drawRectangle(
            new cv.Rect(box.x, box.y, box.width, box.height),
            new cv.Vec3(0, 255, 0), // Green color for motion
            2 // Line thickness
          );
        }
        
        // Calculate motion confidence based on contour areas
        const totalArea = significantContours.reduce((sum, contour) => sum + contour.area, 0);
        const imageArea = img.rows * img.cols;
        const confidence = Math.min(100, Math.round((totalArea / imageArea) * 1000));
        
        // Create motion event
        const event: MotionEvent = {
          id: `evt_motion_${Date.now()}`,
          cameraId,
          timestamp: new Date().toISOString(),
          imagePath: '', // Will be set later
          confidence,
          duration: 0,
          boundingBoxes,
          type: 'motion'
        };
        
        this.io.emit('motionDetected', event);
        console.log(`Motion detected on camera ${cameraId} with confidence ${confidence}%`);
      }

      // Person detection
      const { foundLocations, weights } = await this.hog.detectMultiScale(
        img,
        0,
        new cv.Size(8, 8),
        new cv.Size(32, 32),
        1.05,
        2
      );

      if (foundLocations.length > 0) {
        // Update last event time to avoid quick succession of events
        this.lastEvents.set(cameraId, now);

        // Create bounding boxes for visualization
        const personBoundingBoxes = foundLocations.map((rect: cv.Rect) => ({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }));

        // Draw red bounding boxes for people
        for (const box of personBoundingBoxes) {
          visualizationImg.drawRectangle(
            new cv.Rect(box.x, box.y, box.width, box.height),
            new cv.Vec3(0, 0, 255), // Red color for person
            2 // Line thickness
          );
        }

        // Calculate confidence based on detection weights
        const confidence = Math.round(Math.max(...weights) * 100);

        // Create person detected event
        const event: MotionEvent = {
          id: `evt_person_${Date.now()}`,
          cameraId,
          timestamp: new Date().toISOString(),
          imagePath: '', // Will be set later
          confidence,
          duration: 0,
          boundingBoxes: personBoundingBoxes,
          type: 'person'
        };

        this.events.unshift(event);
        if (this.events.length > 100) {
          this.events.pop();
        }

        this.io.emit('personDetected', event);
        console.log(`Person detected on camera ${cameraId} with confidence ${confidence}%`);

        // If either motion or person is detected, save image and snapshot
        if (motionDetected || foundLocations.length > 0) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `event_${cameraId}_${timestamp}.jpg`;
          const filepath = path.join(eventsDir, filename);

          cv.imwrite(filepath, visualizationImg);

          const eventToUpdate = this.events.find(e => e.id === event.id);
          if (eventToUpdate) {
            eventToUpdate.imagePath = `/events/${filename}`;
          }

          try {
            const snapshotPath = await this.streamManager.takeSnapshot(cameraId);
            if (snapshotPath && eventToUpdate) {
              eventToUpdate.imagePath = snapshotPath;
              this.io.emit('eventSnapshot', {
                eventId: event.id,
                snapshotPath
              });
            }
          } catch (error) {
            console.error('Error taking snapshot:', error);
          }
        }
      }
    } catch (error) {
      console.error(`Error in detection for camera ${cameraId}:`, error);
    }
  }

  // Process all active cameras for motion
  async detectMotionOnAllCameras() {
    const cameras = this.streamManager.getAllCameras();
    for (const camera of cameras) {
      if (camera.isActive) {
        await this.detectMotionOnCamera(camera.id);
      }
    }
  }

  // Update motion detection settings for a camera
  updateSettings(cameraId: string, newSettings: Partial<MotionSettings>): boolean {
    const settings = this.settings.get(cameraId);
    if (!settings) {
      return false;
    }

    // Update settings
    Object.assign(settings, newSettings);
    return true;
  }

  // Get motion detection settings for a camera
  getSettings(cameraId: string): MotionSettings | null {
    return this.settings.get(cameraId) || null;
  }

  // Get recent motion events
  getRecentEvents(limit = 20): MotionEvent[] {
    return this.events.slice(0, limit);
  }

  // Get recent events for a specific camera
  getCameraEvents(cameraId: string, limit = 20): MotionEvent[] {
    return this.events
      .filter(event => event.cameraId === cameraId)
      .slice(0, limit);
  }
}

// Create and start motion detection
export function setupMotionDetection(streamManager: StreamManager, io: SocketIOServer): MotionDetector {
  const motionDetector = new MotionDetector(streamManager, io);
  motionDetector.start();
  return motionDetector;
}
