import { consolidatedDetectionService } from './consolidatedDetectionService.js';

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
   * Initialize cleanup service
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
      // Cleanup consolidated detection service (Python OpenCV service)
      await consolidatedDetectionService.cleanupHook();

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
        case 'consolidateddetection':
          await consolidatedDetectionService.cleanupHook();
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
