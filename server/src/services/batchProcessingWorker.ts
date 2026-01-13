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
      const formData = new FormData();
      imagePaths.forEach((imagePath, index) => {
        const fileBuffer = fs.readFileSync(imagePath);
        const blob = new Blob([fileBuffer]);
        formData.append('images', blob, `image_${index}.jpg`);
      });
      formData.append('batchHash', `batch_${Date.now()}`);

      const response = await fetch(`${this.serviceUrl}/detect-batch`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('OpenCV batch detection failed:', error);
      return {
        success: false,
        batchHash: '',
        totalImages: 0,
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
      console.log('Created output directory:', outputDir);
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

      fs.writeFileSync(path.join(outputDir, filename), csvLines.join('\\n'));
    }

    // Database saving is handled by metadata updates
  } catch (error) {
    console.error('Error saving results:', error);
    throw error;
  }
}

// Removed database saving function - using metadata updates instead

async function updateDetectionFilesMetadata(results: any[]): Promise<void> {
  let client;
  try {
    // Create direct PostgreSQL connection for worker
    client = new Client({
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'sentryvision',
      password: process.env.DB_PASSWORD || 'sentryvision123',
      database: process.env.DB_NAME || 'sentryvision'
    });

    await client.connect();

    for (const result of results) {
      try {
        const hash = generateFileHash(result.filename, result.timestamp);

        const metadata = {
          detections: [
            ...result.persons.map((p: any) => ({
              class: 'person',
              confidence: p.confidence,
              bbox: p.boundingBox
            })),
            ...result.faces.map((f: any) => ({
              class: 'face',
              confidence: f.confidence,
              bbox: f.boundingBox,
              name: f.personName,
              isKnown: f.isKnown
            }))
          ],
          detected_at: result.timestamp,
          detection_types: [...new Set([
            ...result.persons.map(() => 'person'),
            ...result.faces.map(() => 'face')
          ])],
          batch_job_id: workerData.jobId
        };

        // Update detection_files table metadata
        await client.query(
          `UPDATE detection_files
           SET metadata = $1::jsonb, updated_at = NOW()
           WHERE file_hash = $2`,
          [JSON.stringify(metadata), hash]
        );
      } catch (error) {
        console.error('Error updating metadata for ' + result.filename + ':', error);
      }
    }

    console.log('Updated detection_files metadata for ' + results.length + ' images');
  } catch (error) {
    console.error('Error updating detection_files metadata:', error);
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
                  confidence: d.confidence,
                  boundingBox: d.bbox
                }));
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
      }
    } catch (error) {
      console.error('Error processing batch starting at index ' + i + ':', error);
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

    // Save results to detection_files metadata
    await updateDetectionFilesMetadata(results);

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
    console.error('Worker error:', error);
    if (parentPort) {
      parentPort.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

main().catch(error => {
  console.error('Worker startup error:', error);
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
