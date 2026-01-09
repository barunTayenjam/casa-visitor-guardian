import { parentPort, workerData } from 'worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import { getBatchProcessingDatabase } from './batchProcessingDatabasePostgres.js';
import { FileHashUtil } from '../utils/fileHash.js';
import { OpenCVServiceClient } from '../services/opencvServiceClient.js';

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

const opencvService = new OpenCVServiceClient(process.env.OPENCV_SERVICE_URL || 'http://opencv-service:8084');

async function processImage(event: any, options: any): Promise<{
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
}> {
  const result = {
    filename: event.filename,
    timestamp: event.timestamp.toISOString(),
    cameraId: event.cameraId,
    persons: [] as any[],
    faces: [] as any[]
  };

  try {
    const fileHash = FileHashUtil.generateQuickHash(event.filename, event.timestamp);
    const fileStats = fs.statSync(event.filePath);
    const fileModified = fileStats.mtime.toISOString();

    if (options.detectionTypes.includes('person') || options.detectionTypes.includes('both')) {
      const personResult = await opencvService.detectObjects({
        imagePath: event.filePath,
        fileHash,
        fileSize: event.size,
        fileModified
      });

      if (personResult.success && personResult.detections) {
        result.persons = personResult.detections
          .filter((d: any) => d.class === 'person')
          .filter((d: any) => d.confidence >= options.confidenceThreshold)
          .map((d: any) => ({
            confidence: d.confidence,
            boundingBox: d.bbox
          }));
      }
    }

    if (options.detectionTypes.includes('face') || options.detectionTypes.includes('both')) {
      const faceResult = await opencvService.recognizeFaces({
        imagePath: event.filePath,
        fileHash,
        fileSize: event.size,
        fileModified
      });

      if (faceResult.success && faceResult.faceDetections) {
        result.faces = faceResult.faceDetections
          .filter((f: any) => f.confidence >= options.confidenceThreshold)
          .map((f: any) => ({
            confidence: f.confidence,
            boundingBox: f.bbox,
            personId: f.name,
            personName: f.name,
            isKnown: !!f.id
          }));
      }
    }
  } catch (error) {
    console.error('Error processing image ' + event.filename + ':', error);
    throw error;
  }

  return result;
}

async function saveResults(results: any[], options: any, outputDir: string, jobId: string): Promise<void> {
  if (!options.saveResults) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = "batch_" + jobId + "_" + timestamp + "." + options.outputFormat;

  try {
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

    if (options.outputFormat === 'database') {
      await saveResultsToDatabase(results, jobId);
    }
  } catch (error) {
    console.error('Error saving results:', error);
    throw error;
  }
}

  async function saveResultsToDatabase(results: any[], jobId: string): Promise<void> {
    try {
      const db = await getBatchProcessingDatabase();
      
      let savedCount = 0;
      for (const result of results) {
        try {
          const hash = FileHashUtil.generateQuickHash(
            result.filename,
            result.timestamp
          );
          
          const processedImage = {
            id: jobId + "_" + result.filename + "_" + Date.now(),
            job_id: jobId,
            filename: result.filename,
            file_path: "/events/" + result.filename,
            camera_id: result.cameraId,
            image_timestamp: result.timestamp,
            file_size: 0,
            person_count: result.persons.length,
            face_count: result.faces.length,
            known_face_count: result.faces.filter((f: any) => f.isKnown).length,
            unknown_face_count: result.faces.filter((f: any) => !f.isKnown).length,
            processing_time_ms: 0,
            status: 'success' as 'success' | 'failed',
            detection_json: JSON.stringify(result),
            file_hash: hash
          };
          
          await db.addProcessedImage(processedImage);
          savedCount++;
        } catch (error) {
          console.error('Error saving result for ' + result.filename + ':', error);
        }
      }
      
      console.log('Saved ' + savedCount + '/' + results.length + ' processed images to database for job ' + jobId);
    } catch (error) {
      console.error('Error saving results to database:', error);
      throw error;
    }
  }

async function main() {
  const { events, options, jobId, outputDir } = workerData as WorkerData;
  const startTime = Date.now();

  try {
    const results = [];
    let processed = 0;
    let successful = 0;
    let failed = 0;

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

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      try {
        const result = await processImage(event, options);
        results.push(result);
        successful++;

        if ((i + 1) % 10 === 0) {
          if (parentPort) {
            parentPort.postMessage({
              type: 'progress',
              progress: {
                total: events.length,
                processed: i + 1,
                successful,
                failed,
                currentFile: event.filename
              }
            });
          }
        }
      } catch (error) {
        console.error('Failed to process ' + event.filename + ':', error);
        failed++;
      }

      processed++;
    }

    await saveResults(results, options, outputDir, jobId);

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
