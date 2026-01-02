import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'path';
import crypto from 'node:crypto';
import axios from 'axios';

interface BatchDetectionRequest {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface BatchDetectionProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentImage?: string;
  percentage: number;
}

interface BatchDetectionResult {
  success: boolean;
  progress?: BatchDetectionProgress;
  summary?: {
    totalEvents: number;
    personsDetected: number;
    facesDetected: number;
    vehiclesDetected: number;
    motionEvents: number;
    averageProcessingTime: number;
    processingErrors: number;
  };
  results?: Array<{
    eventId: string;
    imageId: string;
    timestamp: string;
    detections: Array<{
      class: string;
      confidence: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>;
    faceDetections: Array<{
      id: string;
      name: string;
      confidence: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>;
    error?: string;
  }>;
  error?: string;
}

interface EventRecord {
  id: string;
  imageId?: string;
  timestamp: string;
  imagePath?: string;
  type: string;
}

class BatchDetectionService {
  private activeBatches: Map<string, BatchDetectionProgress> = new Map();
  private opencvServiceUrl: string = process.env.OPENCV_SERVICE_URL || 'http://localhost:8084';

  async processBatch(request: BatchDetectionRequest): Promise<BatchDetectionResult> {
    try {
      // Get events to process
      const events = await this.getEvents(request);
      
      if (events.length === 0) {
        return {
          success: true,
          summary: {
            totalEvents: 0,
            personsDetected: 0,
            facesDetected: 0,
            vehiclesDetected: 0,
            motionEvents: 0,
            averageProcessingTime: 0,
            processingErrors: 0
          },
          results: []
        };
      }

      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize progress tracking
      this.activeBatches.set(batchId, {
        total: events.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        percentage: 0
      });

      // Process events
      const results: any[] = [];
      let totalPersons = 0;
      let totalFaces = 0;
      let totalVehicles = 0;
      let totalMotion = 0;
      let processingTimes: number[] = [];
      let errors = 0;

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const progress = this.activeBatches.get(batchId);
        if (progress) {
          progress.currentImage = event.imageId || event.id;
          progress.percentage = Math.round((i / events.length) * 100);
          this.activeBatches.set(batchId, progress);
        }

        try {
          const result = await this.processEvent(event);
          
          if (result.success) {
            results.push(result);
            
            // Count detections
            if (result.detections) {
              result.detections.forEach((d: any) => {
                if (d.class === 'person') totalPersons++;
                else if (d.class === 'vehicle') totalVehicles++;
                else if (d.class === 'motion') totalMotion++;
              });
            }
            
            if (result.faceDetections) {
              totalFaces += result.faceDetections.length;
            }
            
            if (result.processingTime) {
              processingTimes.push(result.processingTime);
            }

            if (progress) {
              progress.succeeded++;
              this.activeBatches.set(batchId, progress);
            }
          } else {
            results.push({
              eventId: event.id,
              imageId: event.imageId,
              timestamp: event.timestamp,
              detections: [],
              faceDetections: [],
              error: result.error
            });
            
            if (progress) {
              progress.failed++;
              this.activeBatches.set(batchId, progress);
            }
            errors++;
          }
        } catch (error: any) {
          console.error(`Error processing event ${event.id}:`, error);
          results.push({
            eventId: event.id,
            imageId: event.imageId,
            timestamp: event.timestamp,
            detections: [],
            faceDetections: [],
            error: error.message
          });
          
          if (progress) {
            progress.failed++;
            this.activeBatches.set(batchId, progress);
          }
          errors++;
        }
      }

      // Finalize progress
      const finalProgress = this.activeBatches.get(batchId);
      if (finalProgress) {
        finalProgress.percentage = 100;
        finalProgress.processed = events.length;
        this.activeBatches.set(batchId, finalProgress);
      }

      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      const summary = {
        totalEvents: events.length,
        personsDetected: totalPersons,
        facesDetected: totalFaces,
        vehiclesDetected: totalVehicles,
        motionEvents: totalMotion,
        averageProcessingTime: Math.round(avgProcessingTime),
        processingErrors: errors
      };

      return {
        success: true,
        progress: this.activeBatches.get(batchId),
        summary,
        results
      };
    } catch (error: any) {
      console.error('Batch detection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processEvent(event: EventRecord): Promise<any> {
    if (!event.imagePath) {
      return {
        eventId: event.id,
        imageId: event.imageId,
        timestamp: event.timestamp,
        detections: [],
        faceDetections: [],
        error: 'No image path available'
      };
    }

    const imageBuffer = fs.readFileSync(event.imagePath);
    const fileHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const stats = fs.statSync(event.imagePath);

    // Run object detection
    const detectionResponse = await axios.post(
      `${this.opencvServiceUrl}/detect-objects`,
      {
        imagePath: event.imagePath,
        fileHash,
        fileSize: stats.size,
        fileModified: stats.mtime.toISOString()
      },
      { timeout: 30000 }
    );

    // Run face recognition
    const faceResponse = await axios.post(
      `${this.opencvServiceUrl}/recognize-faces`,
      {
        imagePath: event.imagePath,
        fileHash,
        fileSize: stats.size,
        fileModified: stats.mtime.toISOString()
      },
      { timeout: 30000 }
    );

    return {
      eventId: event.id,
      imageId: event.imageId,
      timestamp: event.timestamp,
      detections: detectionResponse.data.detections || [],
      faceDetections: faceResponse.data.faceDetections || [],
      success: detectionResponse.data.success && faceResponse.data.success,
      processingTime: (detectionResponse.data.processingTime || 0) + (faceResponse.data.processingTime || 0)
    };
  }

  private async getEvents(request: BatchDetectionRequest): Promise<EventRecord[]> {
    // This would typically query your database
    // For now, return mock data from filesystem
    const eventsDataPath = path.join(process.cwd(), 'data', 'events', 'events.json');
    
    if (fs.existsSync(eventsDataPath)) {
      const data = fs.readFileSync(eventsDataPath, 'utf8');
      let events = JSON.parse(data);
      
      // Filter by date range
      if (request.startDate) {
        const startDate = new Date(request.startDate);
        events = events.filter((e: any) => new Date(e.timestamp) >= startDate);
      }
      
      if (request.endDate) {
        const endDate = new Date(request.endDate);
        events = events.filter((e: any) => new Date(e.timestamp) <= endDate);
      }
      
      // Apply limit
      if (request.limit) {
        events = events.slice(0, request.limit);
      }
      
      return events;
    }
    
    return [];
  }

  getProgress(batchId: string): BatchDetectionProgress | null {
    return this.activeBatches.get(batchId) || null;
  }

  clearProgress(batchId: string): boolean {
    return this.activeBatches.delete(batchId);
  }
}

const batchService = new BatchDetectionService();

export async function batchDetectEvents(req: Request, res: Response) {
  try {
    const { startDate, endDate, limit } = req.body;
    
    console.log('Starting batch detection for events:', { startDate, endDate, limit });
    
    const result = await batchService.processBatch({
      startDate,
      endDate,
      limit
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Batch detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getBatchProgress(req: Request, res: Response) {
  try {
    const { batchId } = req.params;
    
    const progress = batchService.getProgress(batchId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    res.json({
      success: true,
      progress
    });
  } catch (error: any) {
    console.error('Get batch progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function clearBatch(req: Request, res: Response) {
  try {
    const { batchId } = req.params;
    
    const cleared = batchService.clearProgress(batchId);
    
    res.json({
      success: cleared,
      message: cleared ? 'Batch progress cleared' : 'Batch not found'
    });
  } catch (error: any) {
    console.error('Clear batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export { BatchDetectionService };