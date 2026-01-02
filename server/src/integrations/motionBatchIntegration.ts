import { motionTriggeredDetection } from '../detection/motionTriggeredDetection.js';
import { batchProcessingService } from '../services/batchProcessingService.js';
import { EventEmitter } from 'node:events';

/**
 * Integrates motion-triggered detection with batch processing
 * Ensures seamless streaming while enabling smart detection workflows
 */
export class MotionBatchIntegration extends EventEmitter {
  constructor() {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for motion detection events
    motionTriggeredDetection.on('motionDetected', (event) => {
      this.handleMotionDetected(event);
    });

    // Listen for batch processing triggers
    motionTriggeredDetection.on('batchTrigger', (data) => {
      this.handleBatchTrigger(data);
    });
  }

  /**
   * Handle motion detection events
   */
  private handleMotionDetected(event: any): void {
    console.log(`Motion detected on camera ${event.cameraId}: ${event.metadata.totalDetections} objects`);
    
    // Emit to frontend via WebSocket (handled by main server)
    this.emit('motionEvent', event);
  }

  /**
   * Handle batch processing triggers from motion
   */
  private async handleBatchTrigger(data: { cameraId: string; event: any; frames: string[] }): Promise<void> {
    try {
      console.log(`Triggering batch processing for motion on camera ${data.cameraId}`);
      
      // Create batch job for motion frames
      const jobId = await batchProcessingService.startBatchProcessing({
        timeRange: {
          start: new Date(data.event.timestamp),
          end: new Date(Date.now() + 60000) // 1 minute window
        },
        cameraIds: [data.cameraId],
        detectionTypes: ['both'], // Detect both person and face
        confidenceThreshold: 0.5,
        saveResults: true,
        outputFormat: 'json'
      });

      console.log(`Started batch job ${jobId} for motion event ${data.event.id}`);
      
      // Monitor job completion
      this.monitorBatchJob(jobId, data.cameraId);
      
    } catch (error) {
      console.error('Failed to start batch processing for motion:', error);
    }
  }

  /**
   * Monitor batch job completion
   */
  private monitorBatchJob(jobId: string, cameraId: string): void {
    const checkInterval = setInterval(async () => {
      try {
        const status = await batchProcessingService.getJobStatus(jobId);
        
        if (status && status.status === 'completed') {
          console.log(`Batch job ${jobId} completed for camera ${cameraId}`);
          this.emit('batchCompleted', { jobId, cameraId, status });
          clearInterval(checkInterval);
        } else if (status && status.status === 'failed') {
          console.error(`Batch job ${jobId} failed for camera ${cameraId}`);
          this.emit('batchFailed', { jobId, cameraId, error: status.error || 'Unknown error' });
          clearInterval(checkInterval);
        }
      } catch (error) {
        console.error('Error checking batch job status:', error);
        clearInterval(checkInterval);
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Get motion detection status
   */
  getMotionStatus(): any {
    return motionTriggeredDetection.getStatus();
  }

  /**
   * Update motion detection settings
   */
  updateMotionSettings(cameraId: string, settings: any): boolean {
    return motionTriggeredDetection.updateSettings(cameraId, settings);
  }
}

// Singleton instance
export const motionBatchIntegration = new MotionBatchIntegration();
export default motionBatchIntegration;