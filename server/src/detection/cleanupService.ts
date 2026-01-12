import { OpenCVProcessor } from './opencvProcessor.js';
import { facialRecognitionService } from './facialRecognition.js';
import { consolidatedDetectionService } from './consolidatedDetectionService.js';
import { cleanupOptimizedMotionDetection } from './optimizedMotionDetection.js';

/**
 * Cleanup service for managing all detection service resources
 */
export class DetectionCleanupService {
  private static instance: DetectionCleanupService;
  private initialized = false;

  private constructor() {
    console.log('DetectionCleanupService: Initializing');
  }

  static getInstance(): DetectionCleanupService {
    if (!DetectionCleanupService.instance) {
      DetectionCleanupService.instance = new DetectionCleanupService();
    }
    return DetectionCleanupService.instance;
  }

  /**
   * Initialize the cleanup service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.initialized = true;
      console.log('DetectionCleanupService initialized');
    } catch (error) {
      console.error('Failed to initialize DetectionCleanupService:', error);
    }
  }

  /**
   * Cleanup all detection services
   */
  async cleanupAll(): Promise<void> {
    console.log('Starting cleanup of all detection services...');
    
    try {
      // Cleanup OpenCV processor
      await OpenCVProcessor.cleanupHook();
      
      // Cleanup facial recognition service
      await facialRecognitionService.cleanupHook();
      
      // Cleanup consolidated detection service
      await consolidatedDetectionService.cleanupHook();
      
      // Cleanup optimized motion detection
      await cleanupOptimizedMotionDetection();
      
      console.log('All detection services cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up detection services:', error);
    }
  }

  /**
   * Cleanup specific service
   */
  async cleanupService(serviceName: string): Promise<void> {
    console.log(`Cleaning up ${serviceName}...`);
    
    try {
      switch (serviceName.toLowerCase()) {
        case 'opencv':
          await OpenCVProcessor.cleanupHook();
          break;
        case 'facialrecognition':
          await facialRecognitionService.cleanupHook();
          break;
        case 'consolidateddetection':
          await consolidatedDetectionService.cleanupHook();
          break;
        case 'optimizedmotion':
          await cleanupOptimizedMotionDetection();
          break;
        default:
          console.warn(`Unknown service: ${serviceName}`);
      }
    } catch (error) {
      console.error(`Error cleaning up ${serviceName}:`, error);
    }
  }

  /**
   * Get cleanup status
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const detectionCleanupService = DetectionCleanupService.getInstance();
export default detectionCleanupService;