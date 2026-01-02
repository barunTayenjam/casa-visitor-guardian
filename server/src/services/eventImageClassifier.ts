import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';
import { ObjectDetectionService } from '../detection/objectDetectionOpenCV.js';
import { FacialRecognitionService } from '../detection/facialRecognitionOpenCV.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClassificationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalImages: number;
  processedImages: number;
  results: any[];
  errors: string[];
  startTime: Date;
  endTime?: Date;
  options: {
    classifyPerson: boolean;
    classifyFace: boolean;
  };
}

export class EventImageClassifier {
  private jobs: Map<string, ClassificationJob> = new Map();
  private socket: SocketIOServer | null = null;

  constructor(private objectDetectionService: ObjectDetectionService, private facialRecognitionService: FacialRecognitionService) {}

  setSocketServer(socket: SocketIOServer) {
    this.socket = socket;
  }

  async classifyAllEventImages(options: { classifyPerson?: boolean; classifyFace?: boolean }, emitProgress: boolean = true): Promise<ClassificationJob> {
    const jobId = `classify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate options
    if (!options.classifyPerson && !options.classifyFace) {
      throw new Error('Must specify at least one classification type (classifyPerson or classifyFace)');
    }

    // Get all event images
    const eventsDir = path.join(__dirname, '../../public/events');
    if (!fs.existsSync(eventsDir)) {
      throw new Error('Events directory does not exist');
    }

    const imageFiles = fs.readdirSync(eventsDir)
      .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
      .slice(0, 100); // Limit to first 100 images to prevent system overload

    const job: ClassificationJob = {
      id: jobId,
      status: 'processing',
      totalImages: imageFiles.length,
      processedImages: 0,
      results: [],
      errors: [],
      startTime: new Date(),
      options: {
        classifyPerson: !!options.classifyPerson,
        classifyFace: !!options.classifyFace
      }
    };

    this.jobs.set(jobId, job);

    // Process images in batches to avoid memory issues
    const batchSize = 5; // Process 5 images at a time
    for (let i = 0; i < imageFiles.length; i += batchSize) {
      const batch = imageFiles.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (file) => {
        try {
          const imagePath = path.join(eventsDir, file);
          const imageBuffer = await fs.promises.readFile(imagePath);

          const result: any = {
            filename: file,
            path: `/events/${file}`,
            detections: []
          };

          // Run person detection if requested
          if (options.classifyPerson) {
            // Check if object detection service is ready
            if (this.objectDetectionService.isReady()) {
              const personResult = await this.objectDetectionService.detectObjects('batch', imageBuffer);
              if (personResult && personResult.detections) {
                result.detections.push(...personResult.detections.map(d => ({
                  ...d,
                  type: 'person'
                })));
              }
            } else {
              console.warn('Object detection service not ready, skipping person detection for', file);
              job.errors.push(`Object detection model not ready for ${file}`);
            }
          }

          // Run face detection if requested
          if (options.classifyFace) {
            // Check if facial recognition service is ready
            if (this.facialRecognitionService.isReady()) {
              const faceResult = await this.facialRecognitionService.recognizeFaces('batch', imageBuffer);
              if (faceResult && faceResult.faces) {
                result.detections.push(...faceResult.faces.map(f => ({
                  ...f,
                  type: 'face'
                })));
              }
            } else {
              console.warn('Facial recognition service not ready, skipping face detection for', file);
              job.errors.push(`Facial recognition model not ready for ${file}`);
            }
          }

          job.results.push(result);
          job.processedImages++;

          // Emit progress update via WebSocket
          if (emitProgress && this.socket) {
            this.socket.emit('classificationProgress', {
              jobId,
              processed: job.processedImages,
              total: job.totalImages,
              progress: Math.round((job.processedImages / job.totalImages) * 100),
              currentFile: file
            });
          }

          // Emit progress update via WebSocket
          if (emitProgress && this.socket) {
            this.socket.emit('classificationProgress', {
              jobId,
              processed: job.processedImages,
              total: job.totalImages,
              progress: Math.round((job.processedImages / job.totalImages) * 100),
              currentFile: file
            });
          }
        } catch (error) {
          console.error(`Error processing image ${file}:`, error);
          job.errors.push(`Error processing ${file}: ${(error as Error).message}`);
          job.processedImages++;
        }
      }));

      // Small delay to prevent blocking the event loop
      await this.sleep(10);
    }

    // Complete the job
    job.status = 'completed';
    job.endTime = new Date();

    // Emit completion via WebSocket
    if (emitProgress && this.socket) {
      this.socket.emit('classificationCompleted', {
        jobId,
        totalImages: job.totalImages,
        processedImages: job.processedImages,
        detectionCount: job.results.reduce((sum, r) => sum + r.detections.length, 0),
        errorCount: job.errors.length
      });
    }

    return job;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getJobStatus(jobId: string): ClassificationJob | null {
    const job = this.jobs.get(jobId) || null;
    console.log(`getJobStatus called for jobId: ${jobId}, found job:`, job ? 'yes' : 'no');
    if (job) {
      console.log(`Job status: ${job.status}, processed: ${job.processedImages}/${job.totalImages}`);
    }
    return job;
  }

  getAllJobs(): ClassificationJob[] {
    return Array.from(this.jobs.values());
  }
}