/**
 * OpenCV Service Client
 * Handles communication with the isolated OpenCV microservice
 */

import fs from 'node:fs';

interface DetectionRequest {
  imagePath: string;
  fileHash: string;
  fileSize: number;
  fileModified: string;
}

interface DetectionResult {
  success: boolean;
  cached: boolean;
  detections?: Array<{
    class: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  faceDetections?: Array<{
    id: string;
    name: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  processingTime?: number;
  fileHash: string;
  error?: string;
}

class OpenCVServiceClient {
  private serviceUrl: string;
  private enabled: boolean;

  constructor(serviceUrl: string = 'http://localhost:8084') {
    this.serviceUrl = serviceUrl;
    this.enabled = true;
  }

  async detectObjects(request: DetectionRequest): Promise<DetectionResult> {
    if (!this.enabled) {
      return {
        success: false,
        cached: false,
        fileHash: request.fileHash,
        error: 'OpenCV service disabled'
      };
    }

    try {
      console.log(`OpenCV Client: Sending object detection request for ${request.imagePath}`);
      
      const response = await fetch(`${this.serviceUrl}/detect-objects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`OpenCV Client: Object detection result:`, result);
      
      return result;
    } catch (error) {
      console.error('OpenCV Client: Object detection failed:', error);
      return {
        success: false,
        cached: false,
        fileHash: request.fileHash,
        error: error.message
      };
    }
  }

  async recognizeFaces(request: DetectionRequest): Promise<DetectionResult> {
    if (!this.enabled) {
      return {
        success: false,
        cached: false,
        fileHash: request.fileHash,
        error: 'OpenCV service disabled'
      };
    }

    try {
      console.log(`OpenCV Client: Sending face recognition request for ${request.imagePath}`);
      
      const response = await fetch(`${this.serviceUrl}/recognize-faces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`OpenCV Client: Face recognition result:`, result);
      
      return result;
    } catch (error) {
      console.error('OpenCV Client: Face recognition failed:', error);
      return {
        success: false,
        cached: false,
        fileHash: request.fileHash,
        error: error.message
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serviceUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('OpenCV Client: Health check failed:', error);
      return false;
    }
  }

  async checkStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.serviceUrl}/status`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('OpenCV Client: Status check failed:', error);
      return null;
    }
  }

  async detectBatch(imagePaths: string[]): Promise<{
    success: boolean;
    batchHash: string;
    totalImages: number;
    results: Array<{
      fileHash: string;
      success: boolean;
      cached: boolean;
      detections: any[];
      processingTime: number;
    }>;
    totalProcessingTime: number;
    averageProcessingTime: number;
    error?: string;
  }> {
    if (!this.enabled) {
      return {
        success: false,
        batchHash: '',
        totalImages: 0,
        results: [],
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        error: 'OpenCV service disabled'
      };
    }

    try {
      console.log(`OpenCV Client: Sending batch detection request for ${imagePaths.length} images`);

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

      const result = await response.json();
      console.log(`OpenCV Client: Batch detection result:`, result);

      return result;
    } catch (error: any) {
      console.error('OpenCV Client: Batch detection failed:', error);
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

  enable(): void {
    this.enabled = true;
    console.log('OpenCV Client: Service enabled');
  }

  disable(): void {
    this.enabled = false;
    console.log('OpenCV Client: Service disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export { OpenCVServiceClient, type DetectionRequest, type DetectionResult };