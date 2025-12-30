import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import EventEmitter from 'events';
import { getBatchProcessingDatabase, ProcessedImage } from './batchProcessingDatabasePostgres.js';
import { FileHashUtil } from '../utils/fileHash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BatchProcessingJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
  };
  options: {
    timeRange: {
      start: Date;
      end: Date;
    };
    cameraIds?: string[];
    detectionTypes: ('person' | 'face' | 'both')[];
    confidenceThreshold: number;
    saveResults: boolean;
    outputFormat: 'json' | 'csv' | 'database';
  };
  results?: {
    totalImages: number;
    personDetections: number;
    faceDetections: number;
    processingTime: number;
    details: Array<{
      filename: string;
      timestamp: string;
      cameraId: string;
      persons: Array<{
        confidence: number;
        boundingBox: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
      faces: Array<{
        confidence: number;
        boundingBox: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        personId?: string;
        personName?: string;
        isKnown: boolean;
      }>;
    }>;
  };
  error?: string;
}

export class BatchProcessingService extends EventEmitter {
  private jobs: Map<string, BatchProcessingJob> = new Map();
  private activeJobs: Map<string, Worker> = new Map();
  private maxConcurrentJobs: number = 2; // Process max 2 jobs at once
  private eventsDir: string;
  private outputDir: string;
  private db: any = null; // Will be initialized asynchronously

  constructor() {
    super();
    this.eventsDir = path.join(__dirname, '../../public/events');
    this.outputDir = path.join(__dirname, '../../public/batch-results');
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // Initialize database asynchronously
    this.initializeDatabase();
  }
  
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await getBatchProcessingDatabase();
      console.log('Batch processing database initialized');
      
      // Load existing jobs from database
      await this.loadJobsFromDatabase();
    } catch (error) {
      console.error('Failed to initialize batch processing database:', error);
    }
  }
  
  private async loadJobsFromDatabase(): Promise<void> {
    if (!this.db) return;
    
    try {
      const dbJobs = await this.db.getJobs({ limit: 100 }); // Load last 100 jobs
      
      for (const dbJob of dbJobs) {
        const job: BatchProcessingJob = {
          id: dbJob.id,
          status: dbJob.status,
          startTime: dbJob.start_time ? new Date(dbJob.start_time) : undefined,
          endTime: dbJob.end_time ? new Date(dbJob.end_time) : undefined,
          progress: {
            total: dbJob.total_images,
            processed: dbJob.processed_images,
            successful: dbJob.successful_images,
            failed: dbJob.failed_images
          },
          options: JSON.parse(dbJob.options_json),
          results: dbJob.status === 'completed' ? {
            totalImages: dbJob.total_images,
            personDetections: dbJob.person_detections,
            faceDetections: dbJob.face_detections,
            processingTime: dbJob.processing_time_ms || 0,
            details: [] // Will be loaded on demand
          } : undefined,
          error: dbJob.error_message
        };
        
        this.jobs.set(job.id, job);
      }
      
      console.log(`Loaded ${this.jobs.size} jobs from database`);
    } catch (error) {
      console.error('Failed to load jobs from database:', error);
    }
    
    // Load batch result files to create job entries for any missing jobs
    await this.loadBatchResultFiles();
  }

  private async loadBatchResultFiles(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const batchResultsDir = path.join(__dirname, '../../public/batch-results');
      
      if (!fs.existsSync(batchResultsDir)) {
        console.log('Batch results directory not found');
        return;
      }
      
      const files = fs.readdirSync(batchResultsDir).filter(f => f.endsWith('.json'));
      console.log(`Found ${files.length} batch result files`);
      
      for (const file of files) {
        try {
          const filePath = path.join(batchResultsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const batchData = JSON.parse(content);
          
          // Extract job ID from filename
          const jobId = batchData.jobId || file.split('_')[1] + '_' + file.split('_')[2];
          
          // Check if job already exists
          if (!this.jobs.has(jobId)) {
            console.log(`Creating job entry for ${jobId} from file`);
            
            const job: BatchProcessingJob = {
              id: jobId,
              status: 'completed',
              startTime: new Date(batchData.timestamp),
              endTime: new Date(batchData.timestamp),
              progress: {
                total: batchData.summary.totalImages,
                processed: batchData.summary.totalImages,
                successful: batchData.summary.totalImages,
                failed: 0
              },
              options: batchData.options,
              results: {
                totalImages: batchData.summary.totalImages,
                personDetections: batchData.summary.personDetections,
                faceDetections: batchData.summary.faceDetections,
                processingTime: 0, // Not in the batch files
                details: batchData.results
              }
            };
            
            this.jobs.set(jobId, job);
            
            // Also save to database for persistence
            if (this.db) {
              try {
                await this.db.createJob({
                  id: job.id,
                  status: job.status,
                  start_time: job.startTime?.toISOString(),
                  end_time: job.endTime?.toISOString(),
                  total_images: job.progress.total,
                  processed_images: job.progress.processed,
                  successful_images: job.progress.successful,
                  failed_images: job.progress.failed,
                  person_detections: job.results.personDetections,
                  face_detections: job.results.faceDetections,
                  known_faces: batchData.summary.knownFaces,
                  unknown_faces: batchData.summary.unknownFaces,
                  processing_time_ms: job.results.processingTime,
                  options_json: JSON.stringify(job.options),
                  error_message: job.error
                });
              } catch (dbError) {
                console.warn('Failed to save job to database:', dbError.message);
              }
            }
          }
        } catch (fileError) {
          console.error(`Error processing batch result file ${file}:`, fileError);
        }
      }
      
      console.log(`Total jobs after loading files: ${this.jobs.size}`);
    } catch (error) {
      console.error('Error loading batch result files:', error);
    }
  }

  // Get available motion events for batch processing
  async getAvailableEvents(options: {
    startTime: Date;
    endTime: Date;
    cameraIds?: string[];
  }): Promise<Array<{
    filename: string;
      timestamp: Date;
      cameraId: string;
      filePath: string;
      size: number;
    }>> {
    const events: Array<{
      filename: string;
      timestamp: Date;
      cameraId: string;
      filePath: string;
      size: number;
    }> = [];

    try {
      const files = fs.readdirSync(this.eventsDir)
        .filter(file => file.endsWith('.jpg'));

      for (const file of files) {
        // Parse filename: motion_{cameraId}_{timestamp}.jpg
        const parts = file.split('_');
        if (parts.length < 3) continue;

        const cameraId = parts[1];
        const timestampPart = parts[2].replace('.jpg', '');
        
        // Parse timestamp from filename
        let timestamp: Date;
        try {
          // Handle formats like: 2025-10-16T12-36-03-998Z
          if (timestampPart.includes('T') && timestampPart.endsWith('Z')) {
            // Fix the time part: T12-36-03-998Z -> T12:36:03.998Z
            let cleanTimestamp = timestampPart;
            const tIndex = timestampPart.indexOf('T');
            const datePart = timestampPart.substring(0, tIndex);
            let timePart = timestampPart.substring(tIndex + 1);
            
            // Remove final Z and replace time separators
            timePart = timePart.slice(0, -1); // Remove Z
            const timeComponents = timePart.split('-'); // Split by -
            
            if (timeComponents.length >= 3) {
              // Format: 12-36-03-998 -> 12:36:03.998
              const fixedTime = `${timeComponents[0]}:${timeComponents[1]}:${timeComponents[2]}.${timeComponents[3] || '000'}`;
              cleanTimestamp = datePart + 'T' + fixedTime + 'Z';
            } else {
              // Fallback: just replace - with :
              cleanTimestamp = datePart + 'T' + timePart.replace(/-/g, ':') + 'Z';
            }
            
            timestamp = new Date(cleanTimestamp);
          } else {
            // Fallback for other formats
            timestamp = new Date(timestampPart);
          }
          
          // Check if date is valid
          if (isNaN(timestamp.getTime())) {
            continue;
          }
        } catch {
          continue; // Skip invalid timestamps
        }

        // Filter by time range
        if (timestamp < options.startTime || timestamp > options.endTime) {
          continue;
        }

        // Filter by camera IDs if specified
        if (options.cameraIds && !options.cameraIds.includes(cameraId)) {
          continue;
        }

        const filePath = path.join(this.eventsDir, file);
        const stats = fs.statSync(filePath);

        events.push({
          filename: file,
          timestamp,
          cameraId,
          filePath,
          size: stats.size
        });
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return events;
    } catch (error) {
      console.error('Error getting available events:', error);
      return [];
    }
  }

  // Start batch processing job with database persistence
  async startBatchProcessing(options: BatchProcessingJob['options']): Promise<string> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BatchProcessingJob = {
      id: jobId,
      status: 'queued',
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0
      },
      options,
    };

    // Save to memory
    this.jobs.set(jobId, job);
    
    // Save to database
    if (this.db) {
      try {
        await this.db.createJob({
          id: job.id,
          status: job.status,
          start_time: job.startTime?.toISOString(),
          end_time: job.endTime?.toISOString(),
          total_images: 0,
          processed_images: 0,
          successful_images: 0,
          failed_images: 0,
          person_detections: 0,
          face_detections: 0,
          known_faces: 0,
          unknown_faces: 0,
          processing_time_ms: undefined,
          options_json: JSON.stringify(options),
          error_message: job.error
        });
        console.log(`Job ${jobId} saved to database`);
      } catch (error) {
        console.error('Failed to save job to database:', error);
      }
    }
    
    this.emit('jobCreated', job);
    this.processNextJob();
    return jobId;
  }

  // Get job status
  getJobStatus(jobId: string): BatchProcessingJob | null {
    return this.jobs.get(jobId) || null;
  }

  // Get all jobs
  getAllJobs(): BatchProcessingJob[] {
    return Array.from(this.jobs.values());
  }

  // Cancel job
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.endTime = new Date();
      this.emit('jobCancelled', job);
      return true;
    }

    if (job.status === 'running') {
      const worker = this.activeJobs.get(jobId);
      if (worker) {
        worker.terminate();
        this.activeJobs.delete(jobId);
      }
      
      job.status = 'cancelled';
      job.endTime = new Date();
      this.emit('jobCancelled', job);
      return true;
    }

    return false;
  }

  // Get available time ranges for batch processing
  async getAvailableTimeRanges(): Promise<Array<{
    label: string;
    value: {
      start: Date;
      end: Date;
    };
  }>> {
    const ranges = [];
    const now = new Date();

    // Last 1 hour
    ranges.push({
      label: 'Last Hour',
      value: {
        start: new Date(now.getTime() - 60 * 60 * 1000),
        end: now
      }
    });

    // Last 6 hours
    ranges.push({
      label: 'Last 6 Hours',
      value: {
        start: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        end: now
      }
    });

    // Last 24 hours
    ranges.push({
      label: 'Last 24 Hours',
      value: {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now
      }
    });

    // Last 7 days
    ranges.push({
      label: 'Last 7 Days',
      value: {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now
      }
    });

    // Custom range - get earliest event
    try {
      const files = fs.readdirSync(this.eventsDir)
        .filter(file => file.endsWith('.jpg'))
        .map(file => {
          const parts = file.split('_');
          if (parts.length < 3) return new Date(0);
          
          const timestampPart = parts[2].replace('.jpg', '');
          try {
            const datePart = timestampPart.substring(0, 10);
            const timePart = timestampPart.substring(11).replace(/-/g, ':');
            const isoTimestamp = `${datePart}T${timePart}Z`;
            return new Date(isoTimestamp);
          } catch {
            return new Date(0);
          }
        })
        .filter(date => date.getTime() > 0)
        .sort((a, b) => a.getTime() - b.getTime());

      if (files.length > 0) {
        ranges.push({
          label: 'All Available',
          value: {
            start: files[0],
            end: now
          }
        });
      }
    } catch (error) {
      console.warn('Error getting earliest event:', error);
    }

    return ranges;
  }

  // Process next job in queue
  private async processNextJob(): Promise<void> {
    // Check if we have capacity for more jobs
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    // Find next queued job
    const queuedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'queued')
      .sort((a, b) => a.id.localeCompare(b.id));

    if (queuedJobs.length === 0) {
      return;
    }

    const job = queuedJobs[0];
    await this.runJob(job);
  }

  // Run a single job
  private async runJob(job: BatchProcessingJob): Promise<void> {
    job.status = 'running';
    job.startTime = new Date();
    job.progress.total = 0;
    job.progress.processed = 0;
    job.progress.successful = 0;
    job.progress.failed = 0;

    // Update job status in database
    if (this.db) {
      try {
        await this.db.updateJob(job.id, {
          status: job.status,
          start_time: job.startTime.toISOString()
        });
      } catch (error) {
        console.error('Failed to update job status in database:', error);
      }
    }

    this.emit('jobStarted', job);

    try {
      // Get events to process
      const events = await this.getAvailableEvents({
        startTime: job.options.timeRange.start,
        endTime: job.options.timeRange.end,
        cameraIds: job.options.cameraIds
      });

      job.progress.total = events.length;
      this.emit('jobProgress', job);

      if (events.length === 0) {
        job.status = 'completed';
        job.endTime = new Date();
        job.results = {
          totalImages: 0,
          personDetections: 0,
          faceDetections: 0,
          processingTime: 0,
          details: []
        };
        this.emit('jobCompleted', job);
        return;
      }

      // Create worker for processing
      // Always use the compiled .js file from dist directory
      // When running with tsx, we need to navigate from src/services to dist/services
      const workerPath = path.join(__dirname, '../../dist/services/batchProcessingWorker.js');
        
      const worker = new Worker(workerPath, {
        workerData: {
          events,
          options: job.options,
          jobId: job.id,
          outputDir: this.outputDir
        }
      });

      this.activeJobs.set(job.id, worker);

      // Handle worker messages
      worker.on('message', (message) => {
        switch (message.type) {
          case 'progress':
            job.progress = message.progress;
            this.emit('jobProgress', job);
            break;

          case 'completed':
            job.status = 'completed';
            job.endTime = new Date();
            job.results = message.results;
            this.emit('jobCompleted', job);
            break;

          case 'error':
            job.status = 'failed';
            job.endTime = new Date();
            job.error = message.error;
            this.emit('jobFailed', job);
            break;
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        console.error(`Worker error for job ${job.id}:`, error);
        job.status = 'failed';
        job.endTime = new Date();
        job.error = error.message;
        this.emit('jobFailed', job);
      });

      // Handle worker exit
      worker.on('exit', async (code) => {
        this.activeJobs.delete(job.id);
        
        // Process next job if completed successfully
        if (code === 0 && job.status === 'completed') {
          // Update job completion in database
          if (this.db && job.results) {
            try {
              await this.db.updateJob(job.id, {
                status: job.status,
                end_time: job.endTime.toISOString(),
                total_images: job.progress.total,
                processed_images: job.progress.processed,
                successful_images: job.progress.successful,
                failed_images: job.progress.failed,
                person_detections: job.results.personDetections,
                face_detections: job.results.faceDetections,
                known_faces: job.results.details.reduce((sum, r) => sum + r.faces.filter((f: any) => f.isKnown).length, 0),
                unknown_faces: job.results.details.reduce((sum, r) => sum + r.faces.filter((f: any) => !f.isKnown).length, 0),
                processing_time_ms: job.results.processingTime
              });
            } catch (error) {
              console.error('Failed to update job completion in database:', error);
            }
          }
          this.processNextJob();
        } else if (job.status === 'running') {
          job.status = 'failed';
          job.endTime = new Date();
          job.error = `Worker exited with code ${code}`;
          
          // Update job failure in database
          if (this.db) {
            try {
              await this.db.updateJob(job.id, {
                status: job.status,
                end_time: job.endTime.toISOString(),
                error_message: job.error
              });
            } catch (error) {
              console.error('Failed to update job failure in database:', error);
            }
          }
          
          this.emit('jobFailed', job);
          
          // Process next job even if this one failed
          this.processNextJob();
        }
      });

    } catch (error) {
      console.error(`Error running job ${job.id}:`, error);
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Update job failure in database
      if (this.db) {
        try {
          await this.db.updateJob(job.id, {
            status: job.status,
            end_time: job.endTime.toISOString(),
            error_message: job.error
          });
        } catch (dbError) {
          console.error('Failed to update job failure in database:', dbError);
        }
      }
      
      this.emit('jobFailed', job);
      this.activeJobs.delete(job.id);
    }
  }

  // Enhanced methods for database integration
  async startBatchProcessingWithPersistence(options: BatchProcessingJob['options'], skipDuplicates: boolean = true): Promise<string> {
    return await this.startBatchProcessing(options);
  }

  async checkForDuplicateImages(events: Array<{filename: string; timestamp: Date; filePath: string; size: number}>): Promise<Array<{filename: string; timestamp: Date; filePath: string; size: number; isDuplicate: boolean}>> {
    if (!this.db) {
      return events.map(event => ({ ...event, isDuplicate: false }));
    }

    const eventsWithDuplicationStatus = [];
    
    for (const event of events) {
      let isDuplicate = false;
      
      try {
        // Generate hash for the file
        const hash = await FileHashUtil.generateQuickHash(
          event.filename, 
          event.timestamp.toISOString()
        );
        
        // Check if already processed
        isDuplicate = await this.db.isImageProcessed(hash);
      } catch (error) {
        console.error('Error checking duplicate for', event.filename, ':', error);
      }
      
      eventsWithDuplicationStatus.push({
        ...event,
        isDuplicate
      });
    }
    
    return eventsWithDuplicationStatus;
  }

  async getProcessedImageDetails(jobId: string): Promise<ProcessedImage[]> {
    if (!this.db) return [];
    
    try {
      return await this.db.getProcessedImages(jobId);
    } catch (error) {
      console.error('Error getting processed image details:', error);
      return [];
    }
  }

  async getJobSummary() {
    if (!this.db) {
      return {
        total_jobs: this.jobs.size,
        queued_jobs: Array.from(this.jobs.values()).filter(j => j.status === 'queued').length,
        running_jobs: Array.from(this.jobs.values()).filter(j => j.status === 'running').length,
        completed_jobs: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
        failed_jobs: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
        cancelled_jobs: Array.from(this.jobs.values()).filter(j => j.status === 'cancelled').length,
        total_images_processed: 0,
        total_person_detections: 0,
        total_face_detections: 0,
        total_known_faces: 0,
        total_unknown_faces: 0,
        average_processing_time_ms: 0
      };
    }
    
    try {
      return await this.db.getJobSummary();
    } catch (error) {
      console.error('Error getting job summary:', error);
      return null;
    }
  }

  async searchProcessedImages(criteria: {
    cameraId?: string;
    startDate?: string;
    endDate?: string;
    hasPersons?: boolean;
    hasFaces?: boolean;
    hasKnownFaces?: boolean;
    limit?: number;
  }) {
    if (!this.db) return [];
    
    try {
      return await this.db.searchProcessedImages(criteria);
    } catch (error) {
      console.error('Error searching processed images:', error);
      return [];
    }
  }

  async getProcessingHistory(days: number = 7) {
    if (!this.db) return [];
    
    try {
      return await this.db.getProcessingHistory(days);
    } catch (error) {
      console.error('Error getting processing history:', error);
      return [];
    }
  }

  // Clean up old jobs and results
  cleanup(): void {
    const now = new Date();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Clean up old jobs
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.endTime && (now.getTime() - job.endTime.getTime()) > maxAge) {
        this.jobs.delete(jobId);
      }
    }

    // Clean up old result files
    try {
      const files = fs.readdirSync(this.outputDir);
      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        
        if ((now.getTime() - stats.mtime.getTime()) > maxAge) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up batch results:', error);
    }
  }
}

// Singleton instance
export const batchProcessingService = new BatchProcessingService();
export default BatchProcessingService;