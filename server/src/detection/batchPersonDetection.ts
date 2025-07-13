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

export class BatchPersonDetection {
  private io: SocketIOServer;
  private isProcessing: boolean = false;
  private currentJobId: string | null = null;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Process all snapshots in the snapshots directory
   */
  public async processAllSnapshots(options: BatchProcessingOptions = {}): Promise<BatchDetectionResult> {
    if (this.isProcessing) {
      throw new Error('Batch processing is already running');
    }

    this.isProcessing = true;
    this.currentJobId = `batch_${Date.now()}`;
    
    const startTime = Date.now();
    const snapshotsDir = path.join(__dirname, '../../public/snapshots');
    
    // Default options
    const defaultOptions: BatchProcessingOptions = {
      minConfidence: 0.6,
      maxDetections: 10,
      includeSubdirectories: false,
      filePattern: /\.(jpg|jpeg|png)$/i,
      outputResults: true,
      saveAnnotatedImages: false,
      timeFilter: 'all',
      saveDetectedPersons: true,
      cropPersonImages: true,
      ...options
    };

    console.log(`🔍 Starting batch person detection for snapshots...`);
    console.log(`📁 Processing directory: ${snapshotsDir}`);
    console.log(`⚙️ Options:`, defaultOptions);

    // Emit start event
    this.io.emit('batchDetectionStarted', {
      jobId: this.currentJobId,
      directory: snapshotsDir,
      options: defaultOptions
    });

    try {
      // Get all image files
      let imageFiles = this.getImageFiles(snapshotsDir, defaultOptions);
      
      // Apply time filtering
      imageFiles = this.applyTimeFilter(imageFiles, defaultOptions);
      
      console.log(`📸 Found ${imageFiles.length} image files to process`);

      const result: BatchDetectionResult = {
        totalImages: imageFiles.length,
        processedImages: 0,
        personsDetected: 0,
        imagesWithPersons: 0,
        errors: 0,
        processingTime: 0,
        results: []
      };

      // Process each image
      for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = imageFiles[i];
        
        try {
          // Emit progress update
          this.io.emit('batchDetectionProgress', {
            jobId: this.currentJobId,
            current: i + 1,
            total: imageFiles.length,
            currentFile: path.basename(imagePath),
            percentage: Math.round(((i + 1) / imageFiles.length) * 100)
          });

          const imageResult = await this.processImage(imagePath, defaultOptions);
          result.results.push(imageResult);
          result.processedImages++;

          if (imageResult.personDetected) {
            result.imagesWithPersons++;
            result.personsDetected += imageResult.personCount;
          }

          if (imageResult.error) {
            result.errors++;
          }

          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`Error processing image ${imagePath}:`, error);
          result.errors++;
          
          result.results.push({
            imagePath,
            filename: path.basename(imagePath),
            cameraId: this.extractCameraId(imagePath),
            timestamp: this.extractTimestamp(imagePath),
            personDetected: false,
            personCount: 0,
            confidence: 0,
            processingTime: 0,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      result.processingTime = Date.now() - startTime;

      // Save results if requested
      if (defaultOptions.outputResults) {
        await this.saveResults(result);
      }

      console.log(`✅ Batch processing completed:`);
      console.log(`   📊 Total images: ${result.totalImages}`);
      console.log(`   ✅ Processed: ${result.processedImages}`);
      console.log(`   👥 Images with persons: ${result.imagesWithPersons}`);
      console.log(`   🔢 Total persons detected: ${result.personsDetected}`);
      console.log(`   ❌ Errors: ${result.errors}`);
      console.log(`   ⏱️ Processing time: ${result.processingTime}ms`);

      // Emit completion event
      this.io.emit('batchDetectionCompleted', {
        jobId: this.currentJobId,
        result
      });

      return result;

    } catch (error) {
      console.error('Batch processing failed:', error);
      
      // Emit error event
      this.io.emit('batchDetectionError', {
        jobId: this.currentJobId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    } finally {
      this.isProcessing = false;
      this.currentJobId = null;
    }
  }

  /**
   * Process a single image for person detection
   */
  private async processImage(imagePath: string, options: BatchProcessingOptions): Promise<ImageDetectionResult> {
    const startTime = Date.now();
    const filename = path.basename(imagePath);
    const cameraId = this.extractCameraId(imagePath);
    const timestamp = this.extractTimestamp(imagePath);

    try {
      // Get the global person detector
      const personDetector = (global as any).personDetector;
      if (!personDetector) {
        throw new Error('Person detector not available');
      }

      // Read image file
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Run person detection
      const detectionResult = await personDetector.detectPersonsFromImage(cameraId, imageBuffer);
      
      if (!detectionResult) {
        return {
          imagePath,
          filename,
          cameraId,
          timestamp,
          personDetected: false,
          personCount: 0,
          confidence: 0,
          processingTime: Date.now() - startTime,
          error: 'Detection failed - no result returned'
        };
      }

      // Process detection boxes and save person images if requested
      const detectionBoxes = [];
      const savedPersonImages: string[] = [];
      
      if (detectionResult.boxes && detectionResult.scores) {
        for (let i = 0; i < detectionResult.boxes.length; i++) {
          const box = detectionResult.boxes[i];
          const confidence = Math.round(detectionResult.scores[i] * 100);
          
          detectionBoxes.push({
            box,
            confidence
          });

          // Save cropped person image if requested
          if (options.saveDetectedPersons && options.cropPersonImages) {
            try {
              const personImagePath = await this.savePersonImage(
                imageBuffer, 
                box, 
                cameraId, 
                timestamp, 
                i, 
                confidence
              );
              if (personImagePath) {
                savedPersonImages.push(personImagePath);
              }
            } catch (error) {
              console.warn(`Failed to save person image ${i}:`, error);
            }
          }
        }
      }

      return {
        imagePath,
        filename,
        cameraId,
        timestamp,
        personDetected: detectionResult.personDetected,
        personCount: detectionResult.personCount || 0,
        confidence: Math.round(detectionResult.highestConfidence * 100) || 0,
        processingTime: Date.now() - startTime,
        detectionBoxes,
        savedPersonImages
      };

    } catch (error) {
      console.error(`Error processing image ${filename}:`, error);
      return {
        imagePath,
        filename,
        cameraId,
        timestamp,
        personDetected: false,
        personCount: 0,
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Save cropped person image from detection box
   */
  private async savePersonImage(
    imageBuffer: Buffer, 
    box: number[], 
    cameraId: string, 
    timestamp: string, 
    personIndex: number, 
    confidence: number
  ): Promise<string | null> {
    try {
      // Create detected-persons directory if it doesn't exist
      const detectedPersonsDir = path.join(__dirname, '../../public/detected-persons');
      if (!fs.existsSync(detectedPersonsDir)) {
        fs.mkdirSync(detectedPersonsDir, { recursive: true });
      }

      // For now, save the full image with metadata
      // TODO: Implement actual image cropping using sharp or canvas
      const cleanTimestamp = timestamp.replace(/[:.]/g, '-');
      const filename = `person_${cameraId}_${cleanTimestamp}_${personIndex}_conf${confidence}.jpg`;
      const filepath = path.join(detectedPersonsDir, filename);

      // Save the full image (cropping will be implemented later)
      fs.writeFileSync(filepath, imageBuffer);

      // Create metadata file
      const metadataFilename = filename.replace('.jpg', '_metadata.json');
      const metadataFilepath = path.join(detectedPersonsDir, metadataFilename);
      
      const metadata = {
        originalImage: filename,
        cameraId,
        timestamp,
        personIndex,
        confidence,
        boundingBox: box,
        detectionDate: new Date().toISOString(),
        cropped: false // Will be true when we implement actual cropping
      };

      fs.writeFileSync(metadataFilepath, JSON.stringify(metadata, null, 2));

      console.log(`💾 Saved person image: ${filename} (confidence: ${confidence}%)`);
      return `/detected-persons/${filename}`;

    } catch (error) {
      console.error('Error saving person image:', error);
      return null;
    }
  }

  /**
   * Apply time filtering to image files
   */
  private applyTimeFilter(imageFiles: string[], options: BatchProcessingOptions): string[] {
    if (options.timeFilter === 'all') {
      return imageFiles;
    }

    const now = new Date();
    let cutoffTime: Date;

    switch (options.timeFilter) {
      case 'hour':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        break;
      case 'day':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
        break;
      case 'week':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
        break;
      case 'month':
        cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
      default:
        return imageFiles;
    }

    // Use custom date range if provided
    if (options.customStartDate) {
      cutoffTime = options.customStartDate;
    }

    const endTime = options.customEndDate || now;

    return imageFiles.filter(filePath => {
      try {
        const stats = fs.statSync(filePath);
        const fileTime = stats.mtime;
        return fileTime >= cutoffTime && fileTime <= endTime;
      } catch (error) {
        console.warn(`Could not get file stats for ${filePath}:`, error);
        return false;
      }
    });
  }

  /**
   * Get all image files from directory
   */
  private getImageFiles(directory: string, options: BatchProcessingOptions): string[] {
    const files: string[] = [];

    if (!fs.existsSync(directory)) {
      console.warn(`Directory does not exist: ${directory}`);
      return files;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory() && options.includeSubdirectories) {
        // Recursively process subdirectories
        files.push(...this.getImageFiles(fullPath, options));
      } else if (entry.isFile() && options.filePattern?.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files.sort(); // Sort for consistent processing order
  }

  /**
   * Extract camera ID from filename
   */
  private extractCameraId(imagePath: string): string {
    const filename = path.basename(imagePath);
    
    // Try to extract camera ID from snapshot filename pattern
    // Expected pattern: snapshot_cameraId_timestamp.jpg
    const match = filename.match(/snapshot_([^_]+)_/);
    if (match) {
      return match[1];
    }

    // Fallback: try to extract from any pattern with camera ID
    const cameraMatch = filename.match(/(cam|camera)[\-_]?(\d+|[a-zA-Z0-9]+)/i);
    if (cameraMatch) {
      return cameraMatch[2];
    }

    return 'unknown';
  }

  /**
   * Extract timestamp from filename
   */
  private extractTimestamp(imagePath: string): string {
    const filename = path.basename(imagePath);
    
    // Try to extract ISO timestamp from filename
    const isoMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (isoMatch) {
      return isoMatch[1].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2})/, 'T$1:$2:$3');
    }

    // Fallback to file modification time
    try {
      const stats = fs.statSync(imagePath);
      return stats.mtime.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  /**
   * Save batch processing results to file
   */
  private async saveResults(result: BatchDetectionResult): Promise<void> {
    try {
      const resultsDir = path.join(__dirname, '../../public/batch-results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `batch_detection_${timestamp}.json`;
      const filepath = path.join(resultsDir, filename);

      // Create summary
      const summary = {
        jobId: this.currentJobId,
        timestamp: new Date().toISOString(),
        summary: {
          totalImages: result.totalImages,
          processedImages: result.processedImages,
          personsDetected: result.personsDetected,
          imagesWithPersons: result.imagesWithPersons,
          errors: result.errors,
          processingTime: result.processingTime,
          successRate: result.totalImages > 0 ? (result.processedImages / result.totalImages) * 100 : 0,
          detectionRate: result.processedImages > 0 ? (result.imagesWithPersons / result.processedImages) * 100 : 0
        },
        results: result.results
      };

      fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
      console.log(`📄 Results saved to: ${filepath}`);

      // Also create a CSV summary for easy analysis
      await this.createCSVSummary(result, resultsDir, timestamp);

    } catch (error) {
      console.error('Error saving results:', error);
    }
  }

  /**
   * Create CSV summary of results
   */
  private async createCSVSummary(result: BatchDetectionResult, resultsDir: string, timestamp: string): Promise<void> {
    try {
      const csvFilename = `batch_detection_summary_${timestamp}.csv`;
      const csvFilepath = path.join(resultsDir, csvFilename);

      const csvHeaders = [
        'Filename',
        'Camera ID',
        'Timestamp',
        'Person Detected',
        'Person Count',
        'Confidence (%)',
        'Processing Time (ms)',
        'Error'
      ];

      const csvRows = result.results.map(r => [
        r.filename,
        r.cameraId,
        r.timestamp,
        r.personDetected ? 'Yes' : 'No',
        r.personCount,
        r.confidence,
        r.processingTime,
        r.error || ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      fs.writeFileSync(csvFilepath, csvContent);
      console.log(`📊 CSV summary saved to: ${csvFilepath}`);

    } catch (error) {
      console.error('Error creating CSV summary:', error);
    }
  }

  /**
   * Get current processing status
   */
  public getStatus(): { isProcessing: boolean; jobId: string | null } {
    return {
      isProcessing: this.isProcessing,
      jobId: this.currentJobId
    };
  }

  /**
   * Cancel current batch processing (if running)
   */
  public cancelProcessing(): boolean {
    if (this.isProcessing) {
      this.isProcessing = false;
      this.currentJobId = null;
      
      this.io.emit('batchDetectionCancelled', {
        message: 'Batch processing was cancelled by user'
      });
      
      return true;
    }
    return false;
  }

  /**
   * Get list of available batch result files
   */
  public getAvailableResults(): Array<{ filename: string; timestamp: string; size: number }> {
    try {
      const resultsDir = path.join(__dirname, '../../public/batch-results');
      if (!fs.existsSync(resultsDir)) {
        return [];
      }

      const files = fs.readdirSync(resultsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filepath = path.join(resultsDir, file);
          const stats = fs.statSync(filepath);
          return {
            filename: file,
            timestamp: stats.mtime.toISOString(),
            size: stats.size
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return files;
    } catch (error) {
      console.error('Error getting available results:', error);
      return [];
    }
  }

  /**
   * Get specific batch result by filename
   */
  public getBatchResult(filename: string): any {
    try {
      const resultsDir = path.join(__dirname, '../../public/batch-results');
      const filepath = path.join(resultsDir, filename);
      
      if (!fs.existsSync(filepath)) {
        throw new Error('Result file not found');
      }

      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading batch result:', error);
      throw error;
    }
  }
}

// Export singleton instance
let batchPersonDetection: BatchPersonDetection | null = null;

export function setupBatchPersonDetection(io: SocketIOServer): BatchPersonDetection {
  if (!batchPersonDetection) {
    batchPersonDetection = new BatchPersonDetection(io);
    
    // Make available globally
    (global as any).batchPersonDetection = batchPersonDetection;
    
    console.log('✅ Batch person detection system initialized');
  }
  
  return batchPersonDetection;
}

export function getBatchPersonDetection(): BatchPersonDetection | null {
  return batchPersonDetection;
}