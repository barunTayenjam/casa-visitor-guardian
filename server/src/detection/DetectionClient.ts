import { logger } from '../utils/logger.js';

export class DetectionClient {
  async pushConfig(cameraId: string, settings: any): Promise<void> {
    try {
      const { getOpenCVClient } = await import('../services/opencvMicroserviceClient.js');
      const opencvClient = getOpenCVClient();
      if (opencvClient) {
        await opencvClient.pushDetectionConfig(cameraId, settings);
      }
    } catch (pushError) {
      logger.warn(`Failed to push config to Python: ${pushError}`, 'DetectionClient');
    }
  }
}
