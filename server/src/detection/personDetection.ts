import { Server as SocketIOServer } from 'socket.io';
import { StreamManager } from '../streams/rtspManager.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

interface PersonDetectionResult {
  boxes: number[][];
  scores: number[];
  classes: number[];
  personDetected: boolean;
  eventImagePath?: string;
  personCount: number;
  highestConfidence: number;
  detectionTime: number;
}

// Flag to track if person detection is available
let personDetectionAvailable = false;

// Define a type alias for the TensorFlow.js module
type TensorFlowModule = typeof import('@tensorflow/tfjs-node');

// Mock implementation for when TensorFlow isn't available
const mockTf = {
  ready: Promise.resolve(),
  setBackend: () => {},
  loadGraphModel: () => ({
    predict: () => ({
      dataSync: () => [],
      dispose: () => {}
    }),
    executeAsync: async () => [{
      dataSync: () => [],
      dispose: () => {}
    }],
    dispose: () => {}
  }),
  decodeImage: () => { throw new Error('TensorFlow not available'); } // Added for type compatibility
};

// Declare variable to hold the module
let tf: TensorFlowModule | typeof mockTf = mockTf;

// Try to load the real module
const loadModule = async () => {
  try {
    console.log('Attempting to load @tensorflow/tfjs-node...');
    const tfModule = await import('@tensorflow/tfjs-node');
    tf = tfModule;
    console.log('TensorFlow.js-node module imported. Ensuring it is ready...');
    await tf.ready(); // Ensure TensorFlow.js is ready
    console.log('TensorFlow.js-node is ready. Setting backend to CPU...');
    tf.setBackend('cpu'); // Explicitly set backend to CPU
    console.log('tf object after loading module:', tf);
    // tf.enableProdMode(); // Enable production mode for performance
    // tf.ENV.set('WEBGL_PACK_DEPTHWISE', false); // Workaround for some WebGL issues
    // tf.ENV.set('WEBGL_CONV_IM2COL', false); // Workaround for some WebGL issues
    personDetectionAvailable = true;
    console.log('Person detection module loaded successfully and backend set to CPU.');
  } catch (error) {
    console.error('Detailed error loading person detection module:', error);
    console.log('Person detection will be disabled due to the above error.');
  }
};

// Start loading module in the background
loadModule();

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
  maxDetections: number; // Maximum number of persons to detect per frame
  enableBoundingBoxes: boolean; // Whether to save images with bounding boxes
  enableZoneDetection: boolean; // Whether to enable detection zones
  detectionZones?: DetectionZone[]; // Specific zones to monitor
}

// Detection zone interface
interface DetectionZone {
  id: string;
  name: string;
  points: { x: number; y: number }[]; // Polygon points (normalized 0-1)
  enabled: boolean;
}

// Store detection settings for each camera
const cameraSettings = new Map<string, PersonDetectionSettings>();

// Store last event time for each camera
const lastEventTimes = new Map<string, number>();

// Store performance metrics
const performanceMetrics = new Map<string, {
  totalDetections: number;
  averageDetectionTime: number;
  lastDetectionTime: number;
  errorCount: number;
  lastError?: string;
}>();

// Utility function to check if a point is inside a polygon (detection zone)
function isPointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
        (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

// Utility function to check if a bounding box intersects with any detection zone
function isDetectionInZones(box: number[], zones: DetectionZone[]): boolean {
  if (!zones || zones.length === 0) return true; // No zones means detect everywhere
  
  // Convert box coordinates to center point (normalized 0-1)
  const centerX = (box[0] + box[2]) / 2;
  const centerY = (box[1] + box[3]) / 2;
  const centerPoint = { x: centerX, y: centerY };
  
  // Check if center point is in any enabled zone
  return zones.some(zone => zone.enabled && isPointInPolygon(centerPoint, zone.points));
}

// Person detection class
export class PersonDetector {
  private streamManager: StreamManager;
  private io: SocketIOServer;
  private model: TensorFlowModule['GraphModel'] | null = null;
  private detectionInterval: NodeJS.Timeout | null = null;
  private isModelLoading = false;

  constructor(streamManager: StreamManager, io: SocketIOServer) {
    this.streamManager = streamManager;
    this.io = io;
    
    // Initialize default settings for all cameras
    this.streamManager.getAllCameras().forEach((camera: any) => {
      this.setDefaultSettings(camera.id);
    });
    
    // Load the COCO-SSD model
    this.loadModel();
  }

  // Load the TensorFlow.js COCO-SSD model
  private async loadModel(): Promise<void> {
    if (this.model || this.isModelLoading) return;
    
    // Check if person detection is available
    console.log(`personDetectionAvailable status: ${personDetectionAvailable}`);
    if (!personDetectionAvailable) {
      console.log('Person detection is disabled due to missing dependencies');
      return;
    }
    
    try {
      this.isModelLoading = true;
      console.log('Loading COCO-SSD model for person detection...');
      
      // Set backend to CPU
      await (tf as any).setBackend('cpu');
      if (typeof (tf as any).ready === 'function') {
        await (tf as any).ready();
      }
      // tf.enableProdMode(); // Enable production mode for performance
      // tf.ENV.set('WEBGL_PACK_DEPTHWISE', false); // Workaround for some WebGL issues
      // tf.ENV.set('WEBGL_CONV_IM2COL', false); // Workaround for some WebGL issues
      
      this.model = await (tf as any).loadGraphModel('https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1', {
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
  setDefaultSettings(cameraId: string, systemSettings?: any): void {
    // Use system settings if provided, otherwise use defaults
    const personDetectionEnabled = systemSettings?.detection?.personDetectionEnabled ?? true;
    const personDetectionConfidence = systemSettings?.detection?.personDetectionConfidence ?? 0.6;
    
    cameraSettings.set(cameraId, {
      enabled: personDetectionEnabled,
      minConfidence: personDetectionConfidence, // Use system confidence threshold
      cooldownPeriod: 10000, // 10 seconds between events
      maxDetections: 10, // Maximum 10 persons per frame
      enableBoundingBoxes: true, // Save images with bounding boxes by default
      enableZoneDetection: false, // Disabled by default
      detectionZones: [] // No zones by default
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

  // This method is for testing purposes only
  public async detectPersonsFromImage(cameraId: string, imageData: string | Buffer): Promise<PersonDetectionResult | null> {
    if (!personDetectionAvailable) {
      console.warn('Person detection is not available. Skipping detection from image.');
      return null;
    }

    if (!this.model || typeof (this.model as any).executeAsync !== 'function') {
      console.warn('Person detection model not loaded. Skipping detection from image.');
      return null;
    }

    const startTime = Date.now();
    const settings = cameraSettings.get(cameraId);
    const minConfidence = settings?.minConfidence || 0.5;
    const maxDetections = settings?.maxDetections || 10;

    try {
      console.log('tf object before decodeImage:', tf);
      if (!(tf as any).node || !(tf as any).image) {
        throw new Error('TensorFlow.js-node is not available');
      }
      const imageTensor = (tf as any).node.decodeImage(imageData as Uint8Array, 3);
      const resizedImage = (tf as any).image.resizeBilinear(imageTensor, [300, 300]).toInt();
      const inputTensor = resizedImage.expandDims(0);

      const predictions = await (this.model as any).executeAsync(inputTensor);
      const [boxes, scores, classes] = predictions.map((p: any) => p.dataSync() as number[]);

      inputTensor.dispose();
      predictions.forEach((p: any) => p.dispose());
      imageTensor.dispose();
      resizedImage.dispose();

      const detectionResult: PersonDetectionResult = {
        boxes: [],
        scores: [],
        classes: [],
        personDetected: false,
        personCount: 0,
        highestConfidence: 0,
        detectionTime: Date.now() - startTime
      };

      const validDetections = [];
      for (let i = 0; i < Math.min(scores.length, maxDetections); i++) {
        const score = scores[i];
        const classId = classes[i];

        // COCO-SSD model class ID for 'person' is 1
        if (classId === 1 && score >= minConfidence) {
          const box = Array.from(boxes.slice(i * 4, i * 4 + 4)) as number[];
          
          // Check detection zones if enabled
          if (settings?.enableZoneDetection && settings.detectionZones) {
            if (!isDetectionInZones(box, settings.detectionZones)) {
              continue; // Skip this detection as it's outside zones
            }
          }
          
          validDetections.push({
            box,
            score,
            classId
          });
        }
      }

      if (validDetections.length > 0) {
        detectionResult.personDetected = true;
        detectionResult.personCount = validDetections.length;
        detectionResult.boxes = validDetections.map(d => d.box) as number[][];
        detectionResult.scores = validDetections.map(d => d.score) as number[];
        detectionResult.classes = validDetections.map(d => d.classId) as number[];
        detectionResult.highestConfidence = Math.max(...validDetections.map((d: any) => d.score));
      }

      // Update performance metrics
      this.updatePerformanceMetrics(cameraId, detectionResult.detectionTime);
      
      return detectionResult;

    } catch (error) {
      console.error('Error during person detection from image:', error);
      this.updatePerformanceMetrics(cameraId, 0, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Detect persons from an image file path (helper for batch processing)
   * @param cameraId Camera ID or 'unknown'
   * @param filePath Path to the image file
   */
  public async detectPersonsFromFile(cameraId: string, filePath: string): Promise<PersonDetectionResult | null> {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      return await this.detectPersonsFromImage(cameraId, imageBuffer);
    } catch (error) {
      console.error(`Failed to read image file for person detection: ${filePath}`, error);
      return null;
    }
  }

  /**
   * Create an annotated image with bounding boxes (requires additional dependencies)
   * This is a placeholder for future implementation with canvas or sharp
   */
  private async createAnnotatedImage(imageBuffer: Buffer, detections: any[], outputPath: string): Promise<boolean> {
    try {
      // For now, just copy the original image
      // In the future, this could use canvas or sharp to draw bounding boxes
      fs.writeFileSync(outputPath, imageBuffer);
      
      // TODO: Implement actual bounding box drawing
      // This would require additional dependencies like canvas or sharp
      // Example with sharp:
      // const sharp = require('sharp');
      // const image = sharp(imageBuffer);
      // for (const detection of detections) {
      //   // Draw rectangle for each detection
      // }
      
      return true;
    } catch (error) {
      console.error('Error creating annotated image:', error);
      return false;
    }
  }

  /**
   * Get detection statistics for a camera
   */
  public getDetectionStats(cameraId: string): any {
    const settings = cameraSettings.get(cameraId);
    const lastEventTime = lastEventTimes.get(cameraId);
    const metrics = performanceMetrics.get(cameraId);
    
    return {
      enabled: settings?.enabled || false,
      minConfidence: settings?.minConfidence || 0.6,
      cooldownPeriod: settings?.cooldownPeriod || 10000,
      maxDetections: settings?.maxDetections || 10,
      enableBoundingBoxes: settings?.enableBoundingBoxes || true,
      enableZoneDetection: settings?.enableZoneDetection || false,
      zoneCount: settings?.detectionZones?.length || 0,
      lastEventTime: lastEventTime || null,
      timeSinceLastEvent: lastEventTime ? Date.now() - lastEventTime : null,
      modelLoaded: !!this.model,
      tensorflowAvailable: personDetectionAvailable,
      performance: {
        totalDetections: metrics?.totalDetections || 0,
        averageDetectionTime: metrics?.averageDetectionTime || 0,
        lastDetectionTime: metrics?.lastDetectionTime || 0,
        errorCount: metrics?.errorCount || 0,
        lastError: metrics?.lastError || null
      }
    };
  }

  /**
   * Update performance metrics for a camera
   */
  private updatePerformanceMetrics(cameraId: string, detectionTime: number, error?: string): void {
    let metrics = performanceMetrics.get(cameraId);
    
    if (!metrics) {
      metrics = {
        totalDetections: 0,
        averageDetectionTime: 0,
        lastDetectionTime: 0,
        errorCount: 0
      };
      performanceMetrics.set(cameraId, metrics);
    }

    if (error) {
      metrics.errorCount++;
      metrics.lastError = error;
    } else {
      metrics.totalDetections++;
      metrics.lastDetectionTime = detectionTime;
      
      // Calculate rolling average
      if (metrics.totalDetections === 1) {
        metrics.averageDetectionTime = detectionTime;
      } else {
        metrics.averageDetectionTime = 
          (metrics.averageDetectionTime * (metrics.totalDetections - 1) + detectionTime) / metrics.totalDetections;
      }
    }
  }

  /**
   * Add or update detection zone for a camera
   */
  public addDetectionZone(cameraId: string, zone: DetectionZone): boolean {
    const settings = cameraSettings.get(cameraId);
    if (!settings) return false;

    if (!settings.detectionZones) {
      settings.detectionZones = [];
    }

    // Remove existing zone with same ID
    settings.detectionZones = settings.detectionZones.filter(z => z.id !== zone.id);
    
    // Add new zone
    settings.detectionZones.push(zone);
    
    return true;
  }

  /**
   * Remove detection zone for a camera
   */
  public removeDetectionZone(cameraId: string, zoneId: string): boolean {
    const settings = cameraSettings.get(cameraId);
    if (!settings || !settings.detectionZones) return false;

    const initialLength = settings.detectionZones.length;
    settings.detectionZones = settings.detectionZones.filter(z => z.id !== zoneId);
    
    return settings.detectionZones.length < initialLength;
  }

  /**
   * Get all detection zones for a camera
   */
  public getDetectionZones(cameraId: string): DetectionZone[] {
    const settings = cameraSettings.get(cameraId);
    return settings?.detectionZones || [];
  }

  /**
   * Get overall system statistics for person detection
   */
  public getSystemStats(): any {
    const allCameras = this.streamManager.getAllCameras();
    const totalCameras = allCameras.length;
    const enabledCameras = Array.from(cameraSettings.values()).filter(s => s.enabled).length;
    
    let totalDetections = 0;
    let totalErrors = 0;
    let averageDetectionTime = 0;
    let detectionTimeCount = 0;

    performanceMetrics.forEach((metrics) => {
      totalDetections += metrics.totalDetections;
      totalErrors += metrics.errorCount;
      if (metrics.averageDetectionTime > 0) {
        averageDetectionTime += metrics.averageDetectionTime;
        detectionTimeCount++;
      }
    });

    return {
      modelLoaded: !!this.model,
      tensorflowAvailable: personDetectionAvailable,
      totalCameras,
      enabledCameras,
      disabledCameras: totalCameras - enabledCameras,
      totalDetections,
      totalErrors,
      averageDetectionTime: detectionTimeCount > 0 ? averageDetectionTime / detectionTimeCount : 0,
      uptime: Date.now() - (this.detectionInterval ? Date.now() - 1000 : Date.now()),
      isRunning: !!this.detectionInterval
    };
  }

  /**
   * Reset performance metrics for a camera or all cameras
   */
  public resetMetrics(cameraId?: string): void {
    if (cameraId) {
      performanceMetrics.delete(cameraId);
    } else {
      performanceMetrics.clear();
    }
  }

  // Process all active cameras for person detection
  private async detectPersonsOnAllCameras(): Promise<void> {
    // Check if person detection is available
    if (!personDetectionAvailable) {
      return;
    }
    
    if (!this.model) {
      await this.loadModel();
      if (!this.model) return; // Still not loaded
    }
    
    const cameras = this.streamManager.getAllCameras();
    for (const camera of cameras) {
      if ((camera as any).isActive) {
        await this.detectPersonsOnCamera((camera as any).id);
      }
    }
  }

  // Process a single camera for person detection
  private async detectPersonsOnCamera(cameraId: string, imageBuffer?: Buffer): Promise<void> {
    const startTime = Date.now();
    const settings = cameraSettings.get(cameraId);
    if (!settings || !settings.enabled || !this.model) {
      return;
    }

    // Get the last frame for the camera
    const currentFrame = imageBuffer || this.streamManager.getLastFrame(cameraId);
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
      if (!(tf as any).node || !(tf as any).image) {
        throw new Error('TensorFlow.js-node is not available');
      }
      const imageTensor = (tf as any).node.decodeImage(currentFrame as Uint8Array, 3);
      const resizedImage = (tf as any).image.resizeBilinear(imageTensor, [300, 300]).toInt();
      const inputTensor = resizedImage.expandDims(0);
      
      // Run detection
      const predictions = await (this.model as any).executeAsync(inputTensor);
      
      // Process predictions
      const [boxes, scores, classes, numDetections] = predictions;
      
      // Get data from tensors
      const boxesData = boxes.arraySync() as number[][][];
      const scoresData = scores.arraySync() as number[][];
      const classesData = classes.arraySync() as number[][];
      const numDetectionsData = numDetections.arraySync() as number[];
      
      // Clean up tensors
      imageTensor.dispose();
      resizedImage.dispose();
      inputTensor.dispose();
      predictions.forEach((t: any) => t.dispose());
      
      // Check if any persons were detected (class 1 in COCO-SSD)
      const personDetections = [];
      const numDetections1 = Math.min(settings.maxDetections || 20, numDetectionsData[0]); // Limit detections
      
      for (let i = 0; i < numDetections1; i++) {
        const classId = classesData[0][i];
        const score = scoresData[0][i];
        
        // Class 1 is person in COCO-SSD
        if (classId === 1 && score >= settings.minConfidence) {
          const box = boxesData[0][i];
          const normalizedBox = [box[1], box[0], box[3], box[2]]; // [x1, y1, x2, y2]
          
          // Check detection zones if enabled
          if (settings.enableZoneDetection && settings.detectionZones) {
            if (!isDetectionInZones(normalizedBox, settings.detectionZones)) {
              continue; // Skip this detection as it's outside zones
            }
          }
          
          personDetections.push({
            box: normalizedBox,
            score,
            id: `person_${i}_${Date.now()}` // Unique ID for tracking
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
          if ((currentFrame as any)[0] !== 0xFF || (currentFrame as any)[1] !== 0xD8) {
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
          (max: number, detection: any) => Math.max(max, detection.score), 0
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
          personBoxes: personDetections.map((d: any) => ({
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
        
        // Update performance metrics for successful detection
        this.updatePerformanceMetrics(cameraId, Date.now() - startTime);
      } else {
        // Update performance metrics for detection with no results
        this.updatePerformanceMetrics(cameraId, Date.now() - startTime);
      }
    } catch (error) {
      console.error(`Error in person detection for camera ${cameraId}:`, error);
      this.updatePerformanceMetrics(cameraId, 0, error instanceof Error ? error.message : String(error));
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