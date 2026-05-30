import { logger } from '../utils/logger.js';
import { consolidatedDetectionService } from './consolidatedDetectionService.js';

/**
 * Cleanup service for managing all detection service resources
 */
export class DetectionCleanupService {
  private static instance: DetectionCleanupService;
  private initialized = false;

  private constructor() {
     logger.info('DetectionCleanupService: Initializing', 'Detection');
  }

  static getInstance(): DetectionCleanupService {
    if (!DetectionCleanupService.instance) {
      DetectionCleanupService.instance = new DetectionCleanupService();
    }
    return DetectionCleanupService.instance;
  }

  /**
   * Initialize cleanup service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
       logger.info('DetectionCleanupService initialized', 'Detection');
    } catch (error) {
       logger.error('Failed to initialize DetectionCleanupService', 'Detection', error);
    }
  }

  /**
   * Cleanup all detection services
   */
  async cleanupAll(): Promise<void> {
     logger.info('Starting cleanup of all detection services...', 'Detection');

    try {
      // Cleanup consolidated detection service (Python OpenCV service)
      await consolidatedDetectionService.cleanupHook();

       logger.info('All detection services cleaned up successfully', 'Detection');
    } catch (error) {
       logger.error('Error cleaning up detection services', 'Detection', error);
    }
  }

  /**
   * Cleanup specific service
   */
  async cleanupService(serviceName: string): Promise<void> {
     logger.info(`Cleaning up ${serviceName}...`, 'Detection');

    try {
      switch (serviceName.toLowerCase()) {
        case 'consolidateddetection':
          await consolidatedDetectionService.cleanupHook();
          break;
        default:
           logger.warn(`Unknown service: ${serviceName}`, 'Detection');
      }
    } catch (error) {
       logger.error(`Error cleaning up ${serviceName}`, 'Detection', error);
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
