import { Server as SocketIOServer } from 'socket.io';
import { StreamManager } from '../streams/rtspManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as tf from '@tensorflow/tfjs-node';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure models directory exists
const modelsDir = path.join(__dirname, '../../models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// Person detection settings interface
interface PersonDetectionSettings {
  enabled: boolean;
  minConfidence: number; // 0-1, threshold for person detection
  cooldownPeriod: number; // milliseconds
}

// Store detection settings for each camera
const cameraSettings = new Map<string, PersonDetectionSettings>();

// Store last event time for each camera
const lastEventTimes = new Map<string, number>();

// Person detection class
export class PersonDetector {
  private streamManager: StreamManager;
  private io: SocketIOServer;
  private model: tf.GraphModel | null = null;
  private detectionInterval: NodeJS.Timeout | null = null;
  private isModelLoading = false;

  constructor(streamManager: StreamManager, io: SocketIOServer) {
    this.streamManager = streamManager;
    this.io = io;
    
    // Initialize default settings for all cameras
    this.streamManager.getAllCameras().forEach(camera => {
      this.setDefaultSettings(camera.id);
    });
    
    // Load the COCO-SSD model
    this.loadModel();
  }

  // Load the TensorFlow.js COCO-SSD model
  private async loadModel(): Promise<void> {
    if (this.model || this.isModelLoading) return;
    
    try {
      this.isModelLoading = true;
      console.log('Loading COCO-SSD model for person detection...');
      this.model = await tf.loadGraphModel('https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1', {
        fromTFHub: true
      });
      console.log('COCO-SSD model loaded successfully');
    } catch (error) {
      console.error('Failed to load COCO-SSD model:', error);
    } finally {
      this.isModelLoading = false;
    }
  }

  // Set default person detection settings for a camera
  setDefaultSettings(cameraId: string): void {
    cameraSettings.set(cameraId, {
      enabled: true,
      minConfidence: 0.6, // Default confidence threshold
      cooldownPeriod: 10000 // 10 seconds between events
    });
  }

  // Get person detection settings for a camera
  getSettings(cameraId: string): PersonDetectionSettings | null {
    return cameraSettings.get(cameraId) || null;
  }

  // Update person detection settings for a camera
  updateSettings(cameraId: string, settings: Partial<PersonDetectionSettings>): boolean {
    const currentSettings = cameraSettings.get(cameraId);
    if (!currentSettings) {
      return false;
    }

    // Update settings
    Object.assign(currentSettings, settings);
    return true;
  }

  // Start person detection
  start(): void {
    if (this.detectionInterval) {
      return;
    }

    // Run person detection every 1000ms (1 second)
    this.detectionInterval = setInterval(() => {
      this.detectPersonsOnAllCameras();
    }, 1000);

    console.log('Person detection started');
  }

  // Stop person detection
  stop(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      console.log('Person detection stopped');
    }
  }

  // Process all active cameras for person detection
  private async detectPersonsOnAllCameras(): Promise<void> {
    if (!this.model) {
      await this.loadModel();
      if (!this.model) return; // Still not loaded
    }
    
    const cameras = this.streamManager.getAllCameras();
    for (const camera of cameras) {
      if (camera.isActive) {
        await this.detectPersonsOnCamera(camera.id);
      }
    }
  }

  // Process a single camera for person detection
  private async detectPersonsOnCamera(cameraId: string): Promise<void> {
    const settings = cameraSettings.get(cameraId);
    if (!settings || !settings.enabled || !this.model) {
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

    try {
      // Convert the JPEG buffer to a tensor
      const image = tf.node.decodeImage(currentFrame);
      
      // Run detection
      const predictions = await this.model.executeAsync(image.expandDims(0)) as tf.Tensor[];
      
      // Process predictions
      const [boxes, scores, classes, numDetections] = predictions;
      
      // Get data from tensors
      const boxesData = boxes.arraySync() as number[][][];
      const scoresData = scores.arraySync() as number[][];
      const classesData = classes.arraySync() as number[][];
      const numDetectionsData = numDetections.arraySync() as number[];
      
      // Clean up tensors
      image.dispose();
      predictions.forEach(t => t.dispose());
      
      // Check if any persons were detected (class 1 in COCO-SSD)
      const personDetections = [];
      const numDetections1 = Math.min(20, numDetectionsData[0]); // Limit to 20 detections
      
      for (let i = 0; i < numDetections1; i++) {
        const classId = classesData[0][i];
        const score = scoresData[0][i];
        
        // Class 1 is person in COCO-SSD
        if (classId === 1 && score >= settings.minConfidence) {
          const box = boxesData[0][i];
          personDetections.push({
            box: [box[1], box[0], box[3], box[2]], // [x1, y1, x2, y2]
            score
          });
        }
      }
      
      // If persons detected, trigger event
      if (personDetections.length > 0) {
        // Update last event time
        lastEventTimes.set(cameraId, now);
        
        // Save the event image
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `person_${cameraId}_${timestamp}.jpg`;
        const filepath = path.join(path.join(__dirname, '../../public/events'), filename);
        
        // Write the current frame to a file
        try {
          // Validate that currentFrame is valid JPEG data
          if (!currentFrame || currentFrame.length === 0) {
            console.warn(`Person detected for ${cameraId} but no valid frame data available`);
            return;
          }
          
          // Check if the frame starts with JPEG header (0xFF 0xD8)
          if (currentFrame[0] !== 0xFF || currentFrame[1] !== 0xD8) {
            console.warn(`Person detected for ${cameraId} but frame data is not valid JPEG format`);
            return;
          }
          
          fs.writeFileSync(filepath, currentFrame);
          console.log(`Person detection event image saved: ${filepath}`);
        } catch (error) {
          console.error(`Failed to save person detection event image for ${cameraId}:`, error);
          return;
        }
        
        // Get the highest confidence score
        const highestConfidence = personDetections.reduce(
          (max, detection) => Math.max(max, detection.score), 0
        );
        
        // Create person detection event
        const event = {
          id: `evt_person_${filename}`,
          cameraId,
          timestamp: new Date().toISOString(),
          imagePath: `/events/${filename}`,
          confidence: Math.round(highestConfidence * 100),
          duration: 0, // Will be updated when motion stops
          personDetected: true,
          personCount: personDetections.length,
          personBoxes: personDetections.map(d => ({
            box: d.box,
            confidence: Math.round(d.score * 100)
          }))
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
          console.error('Error taking snapshot:', error);
        }
        
        console.log(`Person detected on camera ${cameraId} with confidence ${Math.round(highestConfidence * 100)}%, count: ${personDetections.length}`);
      }
    } catch (error) {
      console.error(`Error in person detection for camera ${cameraId}:`, error);
    }
  }
}

// Create and start person detection
export function setupPersonDetection(streamManager: StreamManager, io: SocketIOServer): PersonDetector {
  const personDetector = new PersonDetector(streamManager, io);
  personDetector.start();
  
  // Make available globally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).personDetector = personDetector;
  
  return personDetector;
}