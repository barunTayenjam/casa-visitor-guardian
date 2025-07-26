import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { PersonDetector } from './personDetection.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Interface for batch detection result
interface BatchDetectionResult {
  totalImages: number;
  processedImages: number;
  personsDetected: number;
  imagesWithPersons: number;
  errors: number;
  processingTime: number;
  results: ImageDetectionResult[];
}

// Interface for individual image detection result
interface ImageDetectionResult {
  imagePath: string;
  filename: string;
  cameraId: string;
  timestamp: string;
  personDetected: boolean;
  personCount: number;
  confidence: number;
  processingTime: number;
  error?: string;
  detectionBoxes?: Array<{
    box: number[];
    confidence: number;
  }>;
  savedPersonImages?: string[];
}

// Interface for batch processing options
interface BatchProcessingOptions {
  minConfidence?: number;
  maxDetections?: number;
  includeSubdirectories?: boolean;
  filePattern?: RegExp;
  outputResults?: boolean;
  saveAnnotatedImages?: boolean;
  timeFilter?: 'all' | 'hour' | 'day' | 'week' | 'month';
  customStartDate?: Date;
  customEndDate?: Date;
  saveDetectedPersons?: boolean;
  cropPersonImages?: boolean;
}

// BatchPersonDetection class implementation
class BatchPersonDetection {
  private io: SocketIOServer;
  private isProcessing: boolean = false;
  private currentJobId: string | null = null;
  private cancelRequested: boolean = false;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  // Helper: Recursively get all .jpg files in directory
  private getAllSnapshotFiles(dir: string, includeSubdirs = false): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory() && includeSubdirs) {
        results = results.concat(this.getAllSnapshotFiles(filePath, includeSubdirs));
      } else if (stat && stat.isFile() && file.endsWith('.jpg')) {
        results.push(filePath);
      }
    }
    return results;
  }

  // Main batch processing method
  async processDirectory(dirPath: string, options: BatchProcessingOptions = {}): Promise<BatchDetectionResult> {
    this.isProcessing = true;
    this.cancelRequested = false;
    this.currentJobId = `job_${Date.now()}`;
    const startTime = Date.now();
    const includeSubdirs = options.includeSubdirectories ?? false;
    const filePattern = options.filePattern ?? /\.jpg$/i;
    const saveAnnotatedImages = options.saveAnnotatedImages ?? false;
    const minConfidence = options.minConfidence ?? 0.3;
    const maxDetections = options.maxDetections ?? 10;

    // Get all .jpg snapshot files
    let files: string[] = [];
    try {
      files = this.getAllSnapshotFiles(dirPath, includeSubdirs).filter(f => filePattern.test(f));
    } catch (err) {
      this.isProcessing = false;
    return {
      totalImages: 0,
      processedImages: 0,
      personsDetected: 0,
      imagesWithPersons: 0,
        errors: 1,
        processingTime: 0,
        results: [],
      };
    }
    const totalImages = files.length;
    let processedImages = 0;
    let personsDetected = 0;
    let imagesWithPersons = 0;
    let errors = 0;
    const results: ImageDetectionResult[] = [];

    // Get global PersonDetector instance
    const personDetector = (global as any).personDetector as PersonDetector;
    if (!personDetector) {
      this.isProcessing = false;
      throw new Error('PersonDetector is not initialized');
    }

    for (const filePath of files) {
      if (this.cancelRequested) break;
      const filename = path.basename(filePath);
      // Try to extract cameraId from filename (format: snapshot_<cameraId>_...)
      const cameraIdMatch = filename.match(/^snapshot_(.+?)_/);
      const cameraId = cameraIdMatch ? cameraIdMatch[1] : 'unknown';
      const timestamp = new Date().toISOString();
      let detectionResult: ImageDetectionResult = {
        imagePath: filePath,
        filename,
        cameraId,
        timestamp,
        personDetected: false,
        personCount: 0,
        confidence: 0,
      processingTime: 0,
      };
      const imgStart = Date.now();
      try {
        const result = await personDetector.detectPersonsFromImage(cameraId, filePath);
        detectionResult.processingTime = Date.now() - imgStart;
        if (result) {
          detectionResult.personDetected = result.personDetected;
          detectionResult.personCount = result.personCount;
          detectionResult.confidence = result.highestConfidence;
          detectionResult.detectionBoxes = (result.boxes || []).map((box, i) => ({
            box,
            confidence: result.scores ? result.scores[i] : 0,
          }));
          if (result.personDetected) {
            personsDetected += result.personCount;
            imagesWithPersons++;
            // Optionally save annotated image
            if (saveAnnotatedImages && typeof personDetector["createAnnotatedImage"] === "function") {
              const annotatedPath = filePath.replace(/\.jpg$/, '_annotated.jpg');
              try {
                const imageBuffer = fs.readFileSync(filePath);
                await personDetector.createAnnotatedImage(imageBuffer, detectionResult.detectionBoxes, annotatedPath);
                detectionResult.savedPersonImages = [annotatedPath];
              } catch (e) {
                // Ignore annotation errors
              }
            }
          }
        }
      } catch (err: any) {
        detectionResult.error = err.message || String(err);
        errors++;
      }
      results.push(detectionResult);
      processedImages++;
      // Emit progress
      this.io.emit('batchDetectionProgress', {
        jobId: this.currentJobId,
        processedImages,
        totalImages,
        lastResult: detectionResult,
      });
    }
    this.isProcessing = false;
    const processingTime = Date.now() - startTime;
    return {
      totalImages,
      processedImages,
      personsDetected,
      imagesWithPersons,
      errors,
      processingTime,
      results,
    };
  }

  // Process single image for person detection
  async processImage(imagePath: string, options: BatchProcessingOptions = {}): Promise<ImageDetectionResult> {
    console.log('Batch person detection processImage called with:', imagePath, options);
    
    // Mock implementation for now
    return {
      imagePath,
      filename: path.basename(imagePath),
      cameraId: 'unknown',
      timestamp: new Date().toISOString(),
      personDetected: false,
      personCount: 0,
      confidence: 0,
      processingTime: 0
    };
  }

  // Get processing status
  getStatus(): { isProcessing: boolean; jobId: string | null } {
    return {
      isProcessing: this.isProcessing,
      jobId: this.currentJobId
    };
  }

  // Cancel current processing
  cancel(): void {
    this.cancelRequested = true;
    this.isProcessing = false;
    this.currentJobId = null;
  }
}

let batchPersonDetection: BatchPersonDetection | null = null;

export function setupBatchPersonDetection(io: SocketIOServer): BatchPersonDetection {
  if (!batchPersonDetection) {
    batchPersonDetection = new BatchPersonDetection(io);
    
    // Make available globally
    (global as Record<string, unknown>).batchPersonDetection = batchPersonDetection;
    
    console.log('✅ Batch person detection system initialized');
  }
  
  return batchPersonDetection;
}