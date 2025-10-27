import { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import BatchProcessingService from '../services/batchProcessingService.js';
import { validate, commonSchemas } from '../middleware/validation.js';
import { createAuthRateLimit } from '../middleware/rateLimit.js';

// Custom validation rules for batch processing
const batchValidationSchemas = {
  timeRange: {
    start: { type: 'string', required: true },
    end: { type: 'string', required: true }
  },
  cameraIds: { type: 'array', items: { type: 'string' }, optional: true },
  detectionTypes: { type: 'array', items: { enum: ['person', 'face', 'both'] }, minItems: 1, maxItems: 3 },
  confidenceThreshold: { type: 'number', min: 0, max: 1 },
  saveResults: { type: 'boolean' },
  outputFormat: { type: 'string', enum: ['json', 'csv', 'database'] }
};

interface BatchProcessingOptions {
  timeRange: {
    start: string;
    end: string;
  };
  cameraIds?: string[];
  detectionTypes: ('person' | 'face' | 'both')[];
  confidenceThreshold: number;
  saveResults: boolean;
  outputFormat: 'json' | 'csv' | 'database';
}

interface BatchProcessingQuery {
  timeRange?: string;
  cameraIds?: string;
  detectionTypes?: string;
  confidenceThreshold?: string;
  saveResults?: string;
  outputFormat?: string;
}

// Initialize batch processing service (singleton)
import { batchProcessingService } from '../services/BatchProcessingService.js';
const batchService = batchProcessingService;

// Clean up old jobs periodically
setInterval(() => {
  batchService.cleanup();
}, 24 * 60 * 60 * 1000); // Every 24 hours

export function configureBatchProcessingRoutes(app: Express) {
  // Get available time ranges for batch processing
  app.get('/api/batch/time-ranges', async (req: Request, res: Response) => {
    try {
      const ranges = await batchService.getAvailableTimeRanges();
      res.json({
        success: true,
        ranges
      });
    } catch (error) {
      console.error('Error getting time ranges:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get time ranges'
      });
    }
  });

  // Get available events for a time range
  app.get('/api/batch/events/available', async (req: Request, res: Response) => {
    try {
      const { 
        startTime, 
        endTime, 
        cameraIds 
      } = req.query as {
        startTime: string;
        endTime: string;
        cameraIds?: string;
      };

      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: 'startTime and endTime are required'
        });
      }

      const events = await batchService.getAvailableEvents({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        cameraIds: cameraIds ? cameraIds.split(',') : undefined
      });

      res.json({
        success: true,
        events: events.map(event => ({
          filename: event.filename,
          timestamp: event.timestamp.toISOString(),
          cameraId: event.cameraId,
          size: event.size
        }))
      });
    } catch (error) {
      console.error('Error getting available events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available events'
      });
    }
  });

  // Start batch processing job
  app.post('/api/batch/start', [
    createAuthRateLimit(),
    validate({
      body: batchValidationSchemas
    })
  ], async (req: Request, res: Response) => {
    try {
      const options = req.body as BatchProcessingOptions;

      // Validate time range
      const startTime = new Date(options.timeRange.start);
      const endTime = new Date(options.timeRange.end);
      
      if (startTime >= endTime) {
        return res.status(400).json({
          success: false,
          error: 'Start time must be before end time'
        });
      }

      // Validate time range is not too large (max 7 days)
      const maxRange = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (endTime.getTime() - startTime.getTime() > maxRange) {
        return res.status(400).json({
          success: false,
          error: 'Time range cannot exceed 7 days'
        });
      }

      const jobId = await batchService.startBatchProcessing({
        timeRange: {
          start: startTime,
          end: endTime
        },
        cameraIds: options.cameraIds,
        detectionTypes: options.detectionTypes,
        confidenceThreshold: options.confidenceThreshold,
        saveResults: options.saveResults ?? true,
        outputFormat: options.outputFormat ?? 'json'
      });

      res.json({
        success: true,
        jobId,
        message: 'Batch processing job started'
      });
    } catch (error) {
      console.error('Error starting batch processing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start batch processing'
      });
    }
  });

  // Get batch processing job status
  app.get('/api/batch/jobs/:jobId', (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = batchService.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      res.json({
        success: true,
        job
      });
    } catch (error) {
      console.error('Error getting job status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job status'
      });
    }
  });

  // Get all batch processing jobs
  app.get('/api/batch/jobs', (req: Request, res: Response) => {
    try {
      const jobs = batchService.getAllJobs();
      
      // Sort by creation time (newest first)
      jobs.sort((a, b) => b.id.localeCompare(a.id));

      res.json({
        success: true,
        jobs
      });
    } catch (error) {
      console.error('Error getting jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get jobs'
      });
    }
  });

  // Cancel batch processing job
  app.post('/api/batch/jobs/:jobId/cancel', [
    createAuthRateLimit()
  ], async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const cancelled = await batchService.cancelJob(jobId);

      if (!cancelled) {
        return res.status(404).json({
          success: false,
          error: 'Job not found or cannot be cancelled'
        });
      }

      res.json({
        success: true,
        message: 'Job cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel job'
      });
    }
  });

  // Get batch processing results
  app.get('/api/batch/jobs/:jobId/results', (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = batchService.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Job is not completed yet'
        });
      }

      // Try to read the full results file if it exists
      const outputDir = path.join(__dirname, '../../public/batch-results');
      
      const files = fs.readdirSync(outputDir)
        .filter((file: string) => file.startsWith(`batch_${jobId}_`))
        .sort((a: string, b: string) => b.localeCompare(a)); // Get most recent

      if (files.length > 0) {
        const filePath = path.join(outputDir, files[0]);
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const batchResults = JSON.parse(fileContent);
          
          return res.json({
            success: true,
            results: batchResults
          });
        } catch (fileError) {
          console.error('Error reading results file:', fileError);
          // Fall back to job results if file reading fails
        }
      }

      // Fallback to job results if no file found
      res.json({
        success: true,
        results: job.results
      });
    } catch (error) {
      console.error('Error getting job results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job results'
      });
    }
  });

  // Download batch processing results file
  app.get('/api/batch/jobs/:jobId/download', (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = batchService.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      if (job.status !== 'completed' || !job.options.saveResults) {
        return res.status(400).json({
          success: false,
          error: 'Results file not available'
        });
      }

      // Find the results file
      const outputDir = path.join(__dirname, '../../public/batch-results');
      
      const files = fs.readdirSync(outputDir)
        .filter((file: string) => file.startsWith(`batch_${jobId}_`))
        .sort((a: string, b: string) => b.localeCompare(a)); // Get most recent

      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Results file not found'
        });
      }

      const filePath = path.join(outputDir, files[0]);
      const filename = files[0];

      // Send file
      res.download(filePath, filename, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          res.status(500).json({
            success: false,
            error: 'Failed to download results file'
          });
        }
      });
    } catch (error) {
      console.error('Error downloading results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download results file'
      });
    }
  });

  // Get batch processing statistics
  app.get('/api/batch/stats', async (req: Request, res: Response) => {
    try {
      const jobs = batchService.getAllJobs();
      
      const stats = {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'completed').length,
        running: jobs.filter(j => j.status === 'running').length,
        queued: jobs.filter(j => j.status === 'queued').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
        
        // Calculate total processing time and detections
        totalProcessingTime: jobs.reduce((sum, j) => 
          sum + (j.results?.processingTime || 0), 0),
        totalPersonDetections: jobs.reduce((sum, j) => 
          sum + (j.results?.personDetections || 0), 0),
        totalFaceDetections: jobs.reduce((sum, j) => 
          sum + (j.results?.faceDetections || 0), 0),
        
        // Get recent jobs (last 24 hours)
        recentJobs: jobs.filter(j => {
          if (j.endTime) {
            const hoursSinceEnd = (Date.now() - j.endTime.getTime()) / (1000 * 60 * 60);
            return hoursSinceEnd <= 24;
          }
          return false;
        }).length
      };

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Error getting batch stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get batch statistics'
      });
    }
  });

  // Enhanced routes with database persistence

  // Check for duplicate images before processing
  app.post('/api/batch/check-duplicates', [
    createAuthRateLimit(),
    validate({
      body: {
        timeRange: batchValidationSchemas.timeRange,
        cameraIds: batchValidationSchemas.cameraIds
      }
    })
  ], async (req: Request, res: Response) => {
    try {
      const { timeRange, cameraIds } = req.body;
      
      const events = await batchService.getAvailableEvents({
        startTime: new Date(timeRange.start),
        endTime: new Date(timeRange.end),
        cameraIds
      });

      const eventsWithDuplicationStatus = await batchService.checkForDuplicateImages(events);

      const stats = {
        total: eventsWithDuplicationStatus.length,
        duplicates: eventsWithDuplicationStatus.filter(e => e.isDuplicate).length,
        new: eventsWithDuplicationStatus.filter(e => !e.isDuplicate).length
      };

      res.json({
        success: true,
        stats,
        events: eventsWithDuplicationStatus
      });
    } catch (error) {
      console.error('Error checking duplicates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check for duplicates'
      });
    }
  });

  // Start batch processing with duplicate prevention
  app.post('/api/batch/start-with-persistence', [
    createAuthRateLimit(),
    validate({
      body: {
        timeRange: batchValidationSchemas.timeRange,
        cameraIds: batchValidationSchemas.cameraIds,
        detectionTypes: batchValidationSchemas.detectionTypes,
        confidenceThreshold: { ...batchValidationSchemas.confidenceThreshold, required: false },
        saveResults: batchValidationSchemas.saveResults,
        outputFormat: batchValidationSchemas.outputFormat,
        skipDuplicates: { type: 'boolean', required: false }
      }
    })
  ], async (req: Request, res: Response) => {
    try {
      const { timeRange, cameraIds, detectionTypes, confidenceThreshold, saveResults, outputFormat, skipDuplicates } = req.body;

      const options: BatchProcessingOptions = {
        timeRange: {
          start: new Date(timeRange.start),
          end: new Date(timeRange.end)
        },
        cameraIds,
        detectionTypes,
        confidenceThreshold: confidenceThreshold ?? 0.5,
        saveResults: saveResults ?? true,
        outputFormat: outputFormat ?? 'json'
      };

      const jobId = await batchService.startBatchProcessingWithPersistence(options, skipDuplicates ?? true);

      res.json({
        success: true,
        jobId,
        message: 'Batch processing job started with persistence'
      });
    } catch (error) {
      console.error('Error starting batch processing with persistence:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start batch processing with persistence'
      });
    }
  });

  // Get processed image details for a job
  app.get('/api/batch/jobs/:jobId/images', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const images = await batchService.getProcessedImageDetails(jobId);

      res.json({
        success: true,
        images
      });
    } catch (error) {
      console.error('Error getting processed image details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processed image details'
      });
    }
  });

  // Search processed images with filters
  app.get('/api/batch/images/search', async (req: Request, res: Response) => {
    try {
      const {
        cameraId,
        startDate,
        endDate,
        hasPersons,
        hasFaces,
        hasKnownFaces,
        limit
      } = req.query;

      const criteria: any = {};
      
      if (cameraId) criteria.cameraId = cameraId as string;
      if (startDate) criteria.startDate = startDate as string;
      if (endDate) criteria.endDate = endDate as string;
      if (hasPersons === 'true') criteria.hasPersons = true;
      if (hasFaces === 'true') criteria.hasFaces = true;
      if (hasKnownFaces === 'true') criteria.hasKnownFaces = true;
      if (limit) criteria.limit = parseInt(limit as string);

      const images = await batchService.searchProcessedImages(criteria);

      res.json({
        success: true,
        images,
        count: images.length
      });
    } catch (error) {
      console.error('Error searching processed images:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search processed images'
      });
    }
  });

  // Get enhanced job summary from database
  app.get('/api/batch/summary', async (req: Request, res: Response) => {
    try {
      const summary = await batchService.getJobSummary();

      if (!summary) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get job summary'
        });
      }

      res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error('Error getting job summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job summary'
      });
    }
  });

  // Get processing history
  app.get('/api/batch/history', async (req: Request, res: Response) => {
    try {
      const { days = '7' } = req.query;
      const history = await batchService.getProcessingHistory(parseInt(days as string));

      res.json({
        success: true,
        history
      });
    } catch (error) {
      console.error('Error getting processing history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processing history'
      });
    }
  });

  // Get database statistics
  app.get('/api/batch/database-stats', async (req: Request, res: Response) => {
    try {
      if (!batchService.db) {
        return res.status(503).json({
          success: false,
          error: 'Database not available'
        });
      }

      const stats = await batchService.db.getDatabaseStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Error getting database stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get database statistics'
      });
    }
  });
}

export default configureBatchProcessingRoutes;