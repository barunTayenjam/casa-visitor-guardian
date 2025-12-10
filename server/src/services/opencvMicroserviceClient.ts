import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import crypto from 'crypto';

// Types for OpenCV microservice communication
export interface DetectionRequest {
  imagePath: string;
  fileHash: string;
  fileSize: number;
  fileModified: string;
}

export interface DetectionResult {
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

export interface OpenCVServiceStatus {
  status: 'ready' | 'initializing' | 'error';
  initialized: boolean;
  service: string;
}

export class OpenCVMicroserviceClient {
  private client: AxiosInstance;
  private serviceUrl: string;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor(serviceUrl?: string) {
    this.serviceUrl = serviceUrl || process.env.OPENCV_SERVICE_URL || 'http://localhost:8084';
    
    this.client = axios.create({
      baseURL: this.serviceUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`OpenCV Microservice: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('OpenCV Microservice: Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`OpenCV Microservice: Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('OpenCV Microservice: Response error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if the OpenCV microservice is healthy and ready
   */
  async checkHealth(): Promise<boolean> {
    try {
      const now = Date.now();
      
      // Cache health check results for a short period
      if (this.isHealthy && (now - this.lastHealthCheck) < this.healthCheckInterval) {
        return true;
      }

      const response = await this.client.get('/health');
      const isHealthy = response.status === 200 && response.data?.status === 'healthy';
      
      if (isHealthy) {
        this.isHealthy = true;
        this.lastHealthCheck = now;
        console.log('OpenCV Microservice: Health check passed');
      } else {
        this.isHealthy = false;
        console.warn('OpenCV Microservice: Health check failed - service not healthy');
      }
      
      return isHealthy;
    } catch (error) {
      this.isHealthy = false;
      console.error('OpenCV Microservice: Health check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed status of the OpenCV service
   */
  async getStatus(): Promise<OpenCVServiceStatus | null> {
    try {
      const response = await this.client.get('/status');
      return response.data;
    } catch (error) {
      console.error('OpenCV Microservice: Failed to get status:', error);
      return null;
    }
  }

  /**
   * Detect objects in an image using the OpenCV microservice
   */
  async detectObjects(imagePath: string): Promise<DetectionResult> {
    try {
      // Validate file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Generate file metadata
      const stats = fs.statSync(imagePath);
      const fileHash = this.generateFileHash(imagePath, stats);

      const request: DetectionRequest = {
        imagePath,
        fileHash,
        fileSize: stats.size,
        fileModified: stats.mtime.toISOString()
      };

      console.log(`OpenCV Microservice: Detecting objects in ${imagePath}`);
      
      const response = await this.client.post('/detect-objects', request);
      return response.data;
    } catch (error) {
      console.error(`OpenCV Microservice: Object detection failed for ${imagePath}:`, error);
      
      if (axios.isAxiosError(error)) {
        throw new Error(`OpenCV service error: ${error.response?.data?.error || error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Recognize faces in an image using the OpenCV microservice
   */
  async recognizeFaces(imagePath: string): Promise<DetectionResult> {
    try {
      // Validate file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Generate file metadata
      const stats = fs.statSync(imagePath);
      const fileHash = this.generateFileHash(imagePath, stats);

      const request: DetectionRequest = {
        imagePath,
        fileHash,
        fileSize: stats.size,
        fileModified: stats.mtime.toISOString()
      };

      console.log(`OpenCV Microservice: Recognizing faces in ${imagePath}`);
      
      const response = await this.client.post('/recognize-faces', request);
      return response.data;
    } catch (error) {
      console.error(`OpenCV Microservice: Face recognition failed for ${imagePath}:`, error);
      
      if (axios.isAxiosError(error)) {
        throw new Error(`OpenCV service error: ${error.response?.data?.error || error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Generate a hash for file identification and caching
   */
  private generateFileHash(imagePath: string, stats: fs.Stats): string {
    const hash = crypto.createHash('md5');
    
    // Include file path, size, and modification time in hash
    hash.update(imagePath);
    hash.update(stats.size.toString());
    hash.update(stats.mtime.toISOString());
    
    return hash.digest('hex');
  }

  /**
   * Wait for service to be ready (with timeout)
   */
  async waitForReady(timeoutMs: number = 120000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    console.log(`OpenCV Microservice: Waiting for service to be ready (timeout: ${timeoutMs}ms)`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        const isHealthy = await this.checkHealth();
        const status = await this.getStatus();
        
        // Consider service ready if it's healthy, even if not fully initialized
        // This allows mock detection to work while real OpenCV initialization continues
        if (isHealthy && status && status.status === 'ready') {
          console.log('OpenCV Microservice: Service is ready and healthy');
          this.isHealthy = true;
          this.lastHealthCheck = Date.now();
          return true;
        }

        console.log(`OpenCV Microservice: Service status: ${status?.status || 'unknown'}, healthy: ${isHealthy}, waiting...`);
      } catch (error) {
        console.log('OpenCV Microservice: Service not ready yet, waiting...');
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.error('OpenCV Microservice: Timeout waiting for service to be ready');
    return false;
  }

  /**
   * Get the service URL
   */
  getServiceUrl(): string {
    return this.serviceUrl;
  }

  /**
   * Check if the client is currently healthy
   */
  isServiceHealthy(): boolean {
    return this.isHealthy;
  }
}

// Singleton instance for the application
let openCVClient: OpenCVMicroserviceClient | null = null;

export function getOpenCVClient(): OpenCVMicroserviceClient {
  if (!openCVClient) {
    openCVClient = new OpenCVMicroserviceClient();
  }
  return openCVClient;
}

export function resetOpenCVClient(): void {
  openCVClient = null;
}

export default OpenCVMicroserviceClient;