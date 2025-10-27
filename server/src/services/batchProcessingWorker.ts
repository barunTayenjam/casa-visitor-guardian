import { parentPort, workerData } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { getBatchProcessingDatabase } from './batchProcessingDatabase.js';
import { FileHashUtil } from '../utils/fileHash.js';

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

// Mock object detection implementation
class MockObjectDetection {
  static async detectObjects(imagePath: string, options: {
    detectClasses: string[];
    confidenceThreshold: number;
  }) {
    return new Promise((resolve) => {
      // Simulate processing time
      setTimeout(() => {
        // Mock person detection - randomly detect persons
        const detections = [];
        
        if (options.detectClasses.includes('person')) {
          // Simulate random person detection (30% chance)
          if (Math.random() < 0.3) {
            const numPersons = Math.floor(Math.random() * 3) + 1; // 1-3 persons
            
            for (let i = 0; i < numPersons; i++) {
              const confidence = options.confidenceThreshold + Math.random() * (1 - options.confidenceThreshold);
              
              if (confidence >= options.confidenceThreshold) {
                detections.push({
                  class: 'person',
                  confidence,
                  boundingBox: {
                    x: Math.random() * 200 + 50, // Random position 50-250
                    y: Math.random() * 200 + 50, // Random position 50-250
                    width: Math.random() * 100 + 50, // Random width 50-150
                    height: Math.random() * 100 + 100 // Random height 100-200
                  }
                });
              }
            }
          }
        }
        
        resolve({ detections } as any);
      }, 100 + Math.random() * 200); // 100-300ms processing time
    });
  }
}

// Mock face recognition implementation
class MockFaceRecognition {
  static async recognizeFaces(imagePath: string, options: {
    saveDetectionImage?: boolean;
    generateEvent?: boolean;
  }) {
    return new Promise((resolve) => {
      // Simulate processing time
      setTimeout(() => {
        // Mock face detection - randomly detect faces (20% chance)
        const faces = [];
        
        if (Math.random() < 0.2) {
          const numFaces = Math.floor(Math.random() * 2) + 1; // 1-2 faces
          
          for (let i = 0; i < numFaces; i++) {
            const isKnown = Math.random() < 0.3; // 30% chance of known face
            const confidence = 0.6 + Math.random() * 0.4; // 0.6-1.0 confidence
            
            faces.push({
              id: `face_${Date.now()}_${i}`,
              bbox: {
                x: Math.random() * 200 + 50,
                y: Math.random() * 200 + 50,
                width: Math.random() * 80 + 40,
                height: Math.random() * 80 + 40
              },
              confidence,
              embedding: [], // Mock embedding
              person: isKnown ? {
                id: `person_${Math.floor(Math.random() * 100)}`,
                name: `Known Person ${Math.floor(Math.random() * 100)}`,
                isAuthorized: Math.random() < 0.8
              } : null
            });
          }
        }
        
        resolve({
          faces,
          knownFaces: faces.filter((f: any) => f.person),
          unknownFaces: faces.filter((f: any) => !f.person)
        } as any);
      }, 150 + Math.random() * 250); // 150-400ms processing time
    });
  }
}

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
    // Run person detection if requested
    if (options.detectionTypes.includes('person') || options.detectionTypes.includes('both')) {
      const personResult = await MockObjectDetection.detectObjects(event.filePath, {
        detectClasses: ['person'],
        confidenceThreshold: options.confidenceThreshold
      }) as any;
      
      result.persons = personResult.detections
        .filter((d: any) => d.class === 'person')
        .map((d: any) => ({
          confidence: d.confidence,
          boundingBox: d.boundingBox
        }));
    }

    // Run face detection if requested
    if (options.detectionTypes.includes('face') || options.detectionTypes.includes('both')) {
      const faceResult = await MockFaceRecognition.recognizeFaces(event.filePath, {
        saveDetectionImage: false,
        generateEvent: false
      }) as any;
      
      result.faces = faceResult.faces.map((f: any) => ({
        confidence: f.confidence,
        boundingBox: {
          x: f.bbox.x,
          y: f.bbox.y,
          width: f.bbox.width,
          height: f.bbox.height
        },
        personId: f.person?.id,
        personName: f.person?.name,
        isKnown: !!f.person
      }));
    }
  } catch (error) {
    console.error(`Error processing image ${event.filename}:`, error);
    throw error;
  }

  return result;
}

async function saveResults(results: any[], options: any, outputDir: string, jobId: string): Promise<void> {
  if (!options.saveResults) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `batch_${jobId}_${timestamp}.${options.outputFormat}`;

  try {
    // Save to file system (existing functionality)
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
      // Create CSV header
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

    // Save to database if database output is enabled
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
    
    for (const result of results) {
      try {
        // Generate file hash
        const hash = FileHashUtil.generateQuickHash(
          result.filename,
          result.timestamp
        );

        const processedImage = {
          id: `${jobId}_${result.filename}_${Date.now()}`,
          job_id: jobId,
          filename: result.filename,
          file_path: `/public/events/${result.filename}`, // Relative path
          camera_id: result.cameraId,
          image_timestamp: result.timestamp,
          file_size: 0, // Will be updated if needed
          person_count: result.persons.length,
          face_count: result.faces.length,
          known_face_count: result.faces.filter((f: any) => f.isKnown).length,
          unknown_face_count: result.faces.filter((f: any) => !f.isKnown).length,
          processing_time_ms: 0, // Will be calculated if needed
          status: 'success' as const,
          detection_json: JSON.stringify(result),
          file_hash: hash
        };

        await db.addProcessedImage(processedImage);
      } catch (error) {
        console.error(`Error saving result for ${result.filename}:`, error);
        // Continue with other results even if one fails
      }
    }

    console.log(`Saved ${results.length} processed images to database for job ${jobId}`);
  } catch (error) {
    console.error('Error saving results to database:', error);
    throw error;
  }
}

// Main worker function
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

    // Process each image
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      try {
        const result = await processImage(event, options);
        results.push(result);
        successful++;
        
        // Send progress update every 10 images
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
        console.error(`Failed to process ${event.filename}:`, error);
        failed++;
      }
      
      processed++;
    }

    // Save results
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

// Start the worker
main().catch(error => {
  console.error('Worker startup error:', error);
  if (parentPort) {
    parentPort.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});