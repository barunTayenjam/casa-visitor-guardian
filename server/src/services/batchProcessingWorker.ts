import { logger } from '../utils/logger.js';
import { parentPort, workerData } from 'worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import pkg from 'pg';
const { Client } = pkg;

interface WorkerMessage {
  type: 'progress' | 'completed' | 'error';
  progress?: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    currentFile?: string;
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

interface WorkerData {
  events: Array<{
    filename: string;
    timestamp: Date;
    cameraId: string;
    filePath: string;
    size: number;
  }>;
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
  jobId: string;
  outputDir: string;
}

// Simple hash function for files
function generateFileHash(filename: string, timestamp: string): string {
  const data = filename + timestamp;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Simple OpenCV service client for worker
class SimpleOpenCVClient {
  private serviceUrl: string;

  constructor(serviceUrl: string = 'http://opencv:8084') {
    this.serviceUrl = serviceUrl;
  }

  async detectBatch(imagePaths: string[]): Promise<any> {
    try {
      // Use the new /detect-batch-paths endpoint that accepts file paths
      const payload = {
        imagePaths: imagePaths,
        batchHash: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

       logger.info(`OpenCV Client: Sending batch request for ${imagePaths.length} images`, 'BatchWorker');

      const response = await fetch(`${this.serviceUrl}/detect-batch-paths`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
         logger.error(`OpenCV Client: HTTP ${response.status}: ${errorText}`, 'BatchWorker');
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
       logger.info(`OpenCV Client: Batch completed - ${result.successful || 0} successful, ${result.failed || 0} failed`, 'BatchWorker');
      return result;
    } catch (error: any) {
       logger.error('OpenCV batch detection failed', 'BatchWorker', error);
      return {
        success: false,
        batchHash: '',
        totalImages: imagePaths.length,
        successful: 0,
        failed: imagePaths.length,
        results: [],
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        error: error.message
      };
    }
  }
}

const opencvService = new SimpleOpenCVClient(process.env.OPENCV_SERVICE_URL || 'http://opencv:8084');

// Removed individual image processing - using batch processing instead

async function saveResults(results: any[], options: any, outputDir: string, jobId: string): Promise<void> {
  if (!options.saveResults) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = "batch_" + jobId + "_" + timestamp + "." + options.outputFormat;

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
       logger.info(`Created output directory: ${outputDir}`, 'BatchWorker');
    }
    if (options.outputFormat === 'json') {
      const outputData = {
        jobId,
        timestamp: new Date().toISOString(),
        options,
        summary: {
          totalImages: results.length,
          personDetections: results.reduce((sum, r) => sum + r.persons.length, 0),
          faceDetections: results.reduce((sum, r) => sum + r.faces.length, 0),
          knownFaces: results.reduce((sum, r) => sum + r.faces.filter((f: any) => f.isKnown).length, 0),
          unknownFaces: results.reduce((sum, r) => sum + r.faces.filter((f: any) => !f.isKnown).length, 0)
        },
        results: results
      };

      fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(outputData, null, 2));
    } else if (options.outputFormat === 'csv') {
      const csvLines = [
        'Filename,Timestamp,CameraId,PersonsDetected,FacesDetected,KnownFaces,UnknownFaces',
        ...results.map(r => [
          r.filename,
          r.timestamp,
          r.cameraId,
          r.persons.length,
          r.faces.length,
          r.faces.filter((f: any) => f.isKnown).length,
          r.faces.filter((f: any) => !f.isKnown).length
        ])
      ];

      fs.writeFileSync(path.join(outputDir, filename), csvLines.join('\n'));
    }

    // Database saving is handled by metadata updates
  } catch (error) {
       logger.error('Error saving results', 'BatchWorker', error);
    throw error;
  }
}

// Removed database saving function - using metadata updates instead

async function updateProcessedImagesTable(results: any[]): Promise<void> {
  let client;
  try {
    client = new Client({
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'sentryvision',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'sentryvision'
    });

    await client.connect();

    for (const result of results) {
      try {
        const id = `${workerData.jobId}_${result.filename}`;
        
        const knownFaces = result.faces.filter((f: any) => f.isKnown).length;
        const unknownFaces = result.faces.filter((f: any) => !f.isKnown).length;

        const personTypes = result.persons.map((p: any) => p.class || 'person');
        const faceTypes = result.faces.map(() => 'face');
        const allTypes = [...personTypes, ...faceTypes];
        const uniqueTypes = Array.from(new Set(allTypes));
        
        const detectionJson = {
          persons: result.persons,
          faces: result.faces,
          detected_at: result.timestamp,
          detection_types: uniqueTypes
        };

        await client.query(
          `INSERT INTO processed_images 
           (id, job_id, filename, file_path, camera_id, image_timestamp, 
            person_count, face_count, known_face_count, unknown_face_count, 
            status, detection_json, file_hash, processed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
           ON CONFLICT (id) DO UPDATE SET
             person_count = EXCLUDED.person_count,
             face_count = EXCLUDED.face_count,
             known_face_count = EXCLUDED.known_face_count,
             unknown_face_count = EXCLUDED.unknown_face_count,
             detection_json = EXCLUDED.detection_json,
             status = EXCLUDED.status,
             processed_at = NOW()`,
          [
            id,
            workerData.jobId,
            result.filename,
            result.filename,
            result.cameraId,
            result.timestamp,
            result.persons.length,
            result.faces.length,
            knownFaces,
            unknownFaces,
            result.persons.length > 0 || result.faces.length > 0 ? 'success' : 'no_detections',
            JSON.stringify(detectionJson),
            generateFileHash(result.filename, result.timestamp)
          ]
        );
      } catch (error) {
         logger.error('Error updating processed_images for ' + result.filename, 'BatchWorker', error);
      }
    }

     logger.info('Updated processed_images table for ' + results.length + ' images', 'BatchWorker');
  } catch (error) {
     logger.error('Error updating processed_images table', 'BatchWorker', error);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

async function processBatchImages(events: any[], options: any): Promise<any[]> {
  const results = [];
  const batchSize = 10;
  const imagePaths = events.map(e => e.filePath);

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchPaths = batch.map(e => e.filePath);

    try {
      const batchResult = await opencvService.detectBatch(batchPaths);

      if (batchResult.success && batchResult.results) {
        for (let j = 0; j < batchResult.results.length; j++) {
          const event = batch[j];
          const detectionResult = batchResult.results[j];

          const result = {
            filename: event.filename,
            timestamp: event.timestamp.toISOString(),
            cameraId: event.cameraId,
            persons: [] as any[],
            faces: [] as any[]
          };

          if (detectionResult.success && detectionResult.detections) {
            const allDetections = detectionResult.detections;

            if (options.detectionTypes.includes('person') || options.detectionTypes.includes('both')) {
              result.persons = allDetections
                .filter((d: any) => d.class === 'person')
                .filter((d: any) => d.confidence >= options.confidenceThreshold)
                .map((d: any) => ({
                  class: d.class,
                  confidence: d.confidence,
                  boundingBox: d.bbox
                }));
            }

            // Capture all other objects (cars, trucks, dogs, packages, etc.)
            const otherObjects = allDetections
              .filter((d: any) => d.class !== 'person' && d.class !== 'face')
              .filter((d: any) => d.confidence >= options.confidenceThreshold);

            if (otherObjects.length > 0) {
              // Add other objects to persons array with class info
              result.persons.push(...otherObjects.map((d: any) => ({
                class: d.class,
                confidence: d.confidence,
                boundingBox: d.bbox
              })));
            }

            if (options.detectionTypes.includes('face') || options.detectionTypes.includes('both')) {
              result.faces = allDetections
                .filter((d: any) => d.class === 'face')
                .filter((d: any) => d.confidence >= options.confidenceThreshold)
                .map((d: any) => ({
                  confidence: d.confidence,
                  boundingBox: d.bbox,
                  personId: d.name || 'unknown',
                  personName: d.name || 'unknown',
                  isKnown: d.name && d.name !== 'unknown'
                }));
            }
          }

          results.push(result);
        }
      } else {
        // Batch failed entirely, add empty results for all events in this batch
         logger.error('Batch detection failed', 'BatchWorker');
        for (const event of batch) {
          results.push({
            filename: event.filename,
            timestamp: event.timestamp.toISOString(),
            cameraId: event.cameraId,
            persons: [],
            faces: []
          });
        }
      }
    } catch (error) {
       logger.error('Error processing batch starting at index ' + i, 'BatchWorker', error);
      for (const event of batch) {
        results.push({
          filename: event.filename,
          timestamp: event.timestamp.toISOString(),
          cameraId: event.cameraId,
          persons: [],
          faces: []
        });
      }
    }
  }

  return results;
}

async function main() {
  const { events, options, jobId, outputDir } = workerData as WorkerData;
  const startTime = Date.now();

  try {
    if (parentPort) {
      parentPort.postMessage({
        type: 'progress',
        progress: {
          total: events.length,
          processed: 0,
          successful: 0,
          failed: 0
        }
      });
    }

    const results = await processBatchImages(events, options);
    
    let successful = results.filter(r => r.persons.length > 0 || r.faces.length > 0).length;
    let failed = results.filter(r => r.persons.length === 0 && r.faces.length === 0).length;

    if (parentPort) {
      parentPort.postMessage({
        type: 'progress',
        progress: {
          total: events.length,
          processed: events.length,
          successful,
          failed,
          currentFile: events[events.length - 1]?.filename
        }
      });
    }

    // Save results to processed_images table
    await updateProcessedImagesTable(results);

    // Optionally save batch summary file if requested
    if (options.saveResults && options.outputFormat !== 'database') {
      await saveResults(results, options, outputDir, jobId);
    }

    const processingTime = Date.now() - startTime;
    const summary = {
      totalImages: events.length,
      personDetections: results.reduce((sum, r) => sum + r.persons.length, 0),
      faceDetections: results.reduce((sum, r) => sum + r.faces.length, 0),
      processingTime,
      details: results
    };

    if (parentPort) {
      parentPort.postMessage({
        type: 'completed',
        results: summary
      });
    }

  } catch (error) {
     logger.error('Worker error', 'BatchWorker', error);
    if (parentPort) {
      parentPort.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

main().catch(error => {
   logger.error('Worker startup error', 'BatchWorker', error);
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
