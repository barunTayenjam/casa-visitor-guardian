import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

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

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  // Process directory for person detection
  async processDirectory(dirPath: string, options: BatchProcessingOptions = {}): Promise<BatchDetectionResult> {
    console.log('Batch person detection processDirectory called with:', dirPath, options);
    
    // Mock implementation for now
    return {
      totalImages: 0,
      processedImages: 0,
      personsDetected: 0,
      imagesWithPersons: 0,
      errors: 0,
      processingTime: 0,
      results: []
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