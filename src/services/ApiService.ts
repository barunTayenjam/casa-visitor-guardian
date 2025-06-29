import { Camera, MotionEvent } from '@/types/security';

// API URLs are now relative in development mode since we use Vite's proxy
const isDev = import.meta.env.DEV;
const API_URL = isDev ? '/api' : import.meta.env.VITE_API_URL;
const BACKEND_URL = isDev ? '' : import.meta.env.VITE_BACKEND_URL;

// Custom error types
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Type for motion detection settings
interface MotionSettings {
  enabled: boolean;
  sensitivity: number;
  minArea: number;
  cooldownPeriod: number;
  ignoredZones: { x: number; y: number; width: number; height: number }[];
}

// Type for the backend camera model
interface BackendCamera {
  id: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  isActive: boolean;
  frameRate: number;
  resolution: string;
  nightMode: boolean;
  lastError?: string;
}

class ApiService {
  // Fetch API with timeout and retry
  private async fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        let errorDetails: Record<string, unknown> = {};
        
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
          errorDetails = data;
          
          // Special handling for "already streaming" case
          if (data.error && data.error.includes('already streaming')) {
            // Don't throw an error for already streaming - return the response
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch {
          // If JSON parsing fails, use the status text
          errorMessage = response.statusText || errorMessage;
        }

        throw new ApiError(
          errorMessage,
          response.status,
          'API_ERROR',
          errorDetails
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError();
      }

      if (retries > 0 && error instanceof Error && !error.message.includes('aborted')) {
        console.warn(`Request failed, retrying... (${retries} retries left)`, error.message);
        
        // Special handling for connection reset
        if (error.message.includes('ECONNRESET') || error.message.includes('fetch')) {
          console.log('Connection issue detected, waiting longer before retry...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for connection issues
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for other errors
        }
        
        return this.fetchWithRetry(url, options, retries - 1);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new NetworkError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // Convert backend camera to frontend camera format
  private mapBackendToFrontendCamera(camera: BackendCamera): Camera {
    return {
      id: camera.id,
      name: camera.name,
      status: camera.isActive ? 'online' : 'offline',
      streamUrl: camera.rtspUrl,
      thumbnail: '/placeholder-camera.jpg',
      location: '', // Not provided by backend
      detectionEnabled: true, // Default, will be updated from motion settings
      sensitivity: 0.5, // Default, will be updated from motion settings
      lastSeen: new Date(),
      resolution: camera.resolution,
      fps: camera.frameRate,
      error: camera.lastError
    };
  }

  // Fetch all cameras
  async getCameras(): Promise<Camera[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras`);
      const data = await response.json();
      
      if (!data.success || !data.cameras) {
        throw new ApiError(
          data.error || 'Failed to fetch cameras',
          response.status,
          'GET_CAMERAS_ERROR',
          data
        );
      }
      
      // Convert to frontend camera format
      return data.cameras.map(this.mapBackendToFrontendCamera);
    } catch (error) {
      console.error('Error fetching cameras:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch cameras',
        500,
        'GET_CAMERAS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get a single camera by ID
  async getCamera(id: string): Promise<Camera> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras/${id}`);
      const data = await response.json();

      if (!data.success || !data.camera) {
        throw new ApiError(
          data.error || `Failed to fetch camera ${id}`,
          response.status,
          'GET_CAMERA_ERROR',
          data
        );
      }

      return this.mapBackendToFrontendCamera(data.camera);
    } catch (error) {
      console.error(`Error fetching camera ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to fetch camera ${id}`,
        500,
        'GET_CAMERA_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Add a new camera
  async addCamera(camera: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>): Promise<string> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras`, {
        method: 'POST',
        body: JSON.stringify({
          name: camera.name,
          rtspUrl: camera.streamUrl,
          frameRate: camera.fps,
          resolution: camera.resolution,
          // Extract username/password from RTSP URL if present
          ...(camera.streamUrl.includes('@') && {
            username: camera.streamUrl.split('@')[0].split('://')[1].split(':')[0],
            password: camera.streamUrl.split('@')[0].split(':').pop()
          })
        })
      });
      
      const data = await response.json();
      if (!data.success || !data.cameraId) {
        throw new ApiError(
          data.error || 'Failed to add camera',
          response.status,
          'ADD_CAMERA_ERROR',
          data
        );
      }
      return data.cameraId;
    } catch (error) {
      console.error('Error adding camera:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to add camera',
        500,
        'ADD_CAMERA_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Update a camera
  async updateCamera(id: string, updates: Partial<Camera>): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...(updates.name && { name: updates.name }),
          ...(updates.streamUrl && { rtspUrl: updates.streamUrl }),
          ...(updates.fps && { frameRate: updates.fps }),
          ...(updates.resolution && { resolution: updates.resolution })
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to update camera ${id}`,
          response.status,
          'UPDATE_CAMERA_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error updating camera ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to update camera ${id}`,
        500,
        'UPDATE_CAMERA_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Delete a camera
  async deleteCamera(id: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to delete camera ${id}`,
          response.status,
          'DELETE_CAMERA_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error deleting camera ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to delete camera ${id}`,
        500,
        'DELETE_CAMERA_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Start streaming from a camera
  async startCameraStream(id: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras/${id}/stream/start`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (!data.success) {
        // Check if it's already streaming - treat this as success
        if (data.error && data.error.includes('already streaming')) {
          console.log(`Camera ${id} is already streaming`);
          return;
        }
        throw new ApiError(
          data.error || `Failed to start camera stream ${id}`,
          response.status,
          'START_STREAM_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error starting stream for camera ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to start camera stream ${id}`,
        500,
        'START_STREAM_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Stop streaming from a camera
  async stopCameraStream(id: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras/${id}/stream/stop`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to stop camera stream ${id}`,
          response.status,
          'STOP_STREAM_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error stopping stream for camera ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to stop camera stream ${id}`,
        500,
        'STOP_STREAM_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Take a snapshot from a camera
  async takeSnapshot(id: string, resolution?: string): Promise<string> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/cameras/${id}/snapshot`, {
        method: 'POST',
        body: JSON.stringify({ resolution })
      });
      
      const data = await response.json();
      if (!data.success || !data.snapshotPath) {
        throw new ApiError(
          data.error || `Failed to take snapshot for camera ${id}`,
          response.status,
          'SNAPSHOT_ERROR',
          data
        );
      }
      return data.snapshotPath;
    } catch (error) {
      console.error(`Error taking snapshot for camera ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to take snapshot for camera ${id}`,
        500,
        'SNAPSHOT_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Toggle night mode for a camera
  async toggleNightMode(id: string, enabled: boolean): Promise<void> {
    try {
      await this.fetchWithRetry(`${API_URL}/cameras/${id}/night-mode`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });
    } catch (error) {
      console.error(`Error toggling night mode for camera ${id}:`, error);
      throw error;
    }
  }

  // Get motion detection settings for a camera
  async getMotionSettings(cameraId: string): Promise<MotionSettings> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/motion/${cameraId}/settings`);
      const data = await response.json();
      
      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || `Failed to get motion settings for camera ${cameraId}`,
          response.status,
          'GET_MOTION_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error(`Error fetching motion settings for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to get motion settings for camera ${cameraId}`,
        500,
        'GET_MOTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Update motion detection settings for a camera
  async updateMotionSettings(cameraId: string, settings: Partial<MotionSettings>): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/motion/${cameraId}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to update motion settings for camera ${cameraId}`,
          response.status,
          'UPDATE_MOTION_SETTINGS_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error updating motion settings for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to update motion settings for camera ${cameraId}`,
        500,
        'UPDATE_MOTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get recent motion events
  async getMotionEvents(limit = 20): Promise<MotionEvent[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/motion/events?limit=${limit}`);
      const data = await response.json();
      
      if (!data.success || !data.events) {
        throw new ApiError(
          data.error || 'Failed to fetch motion events',
          response.status,
          'GET_MOTION_EVENTS_ERROR',
          data
        );
      }
      return data.events;
    } catch (error) {
      console.error('Error fetching motion events:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch motion events',
        500,
        'GET_MOTION_EVENTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get motion events for a specific camera
  async getCameraMotionEvents(cameraId: string, limit = 20): Promise<MotionEvent[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/motion/${cameraId}/events?limit=${limit}`);
      const data = await response.json();
      
      if (!data.success || !data.events) {
        throw new ApiError(
          data.error || `Failed to fetch motion events for camera ${cameraId}`,
          response.status,
          'GET_CAMERA_MOTION_EVENTS_ERROR',
          data
        );
      }
      return data.events;
    } catch (error) {
      console.error(`Error fetching motion events for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to fetch motion events for camera ${cameraId}`,
        500,
        'GET_CAMERA_MOTION_EVENTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Fetch snapshots list
  async getSnapshots(): Promise<string[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/snapshots/list`);
      const data = await response.json();
      
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to fetch snapshots list',
          response.status,
          'GET_SNAPSHOTS_ERROR',
          data
        );
      }
      return data.files || [];
    } catch (error) {
      console.error('Error fetching snapshots:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch snapshots',
        500,
        'GET_SNAPSHOTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Fetch events list
  async getEventsList(): Promise<string[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/events/list`);
      const data = await response.json();
      
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to fetch events list',
          response.status,
          'GET_EVENTS_ERROR',
          data
        );
      }
      return data.files || [];
    } catch (error) {
      console.error('Error fetching events list:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch events list',
        500,
        'GET_EVENTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get event image URL
  getEventImageUrl(filename: string): string {
    if (!filename) {
      throw new ApiError(
        'Filename is required',
        400,
        'INVALID_FILENAME',
        { filename }
      );
    }
    const url = `${BACKEND_URL}/events/${filename}`;
    console.log('Generated event image URL:', url);
    return url;
  }

  // Get snapshot image URL
  getSnapshotImageUrl(filename: string): string {
    if (!filename) {
      throw new ApiError(
        'Filename is required',
        400,
        'INVALID_FILENAME',
        { filename }
      );
    }
    const url = `${BACKEND_URL}/snapshots/${filename}`;
    console.log('Generated snapshot image URL:', url);
    return url;
  }

  // Get system storage information
  async getSystemStorage(): Promise<{
    used: number;
    total: number;
    eventsSize: number;
    snapshotsSize: number;
    percentage: number;
  }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/system/storage`);
      const data = await response.json();
      
      if (!data.success || !data.storage) {
        throw new ApiError(
          data.error || 'Failed to fetch storage information',
          response.status,
          'GET_STORAGE_ERROR',
          data
        );
      }
      return data.storage;
    } catch (error) {
      console.error('Error fetching storage information:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch storage information',
        500,
        'GET_STORAGE_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get system health information
  async getSystemHealth(): Promise<{
    status: string;
    uptime: number;
    issues: string[];
    cameras: { total: number; online: number; offline: number };
    memory: { used: number; total: number };
    events: { recent: number; today: number };
  }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/system/health`);
      const data = await response.json();
      
      if (!data.success || !data.health) {
        throw new ApiError(
          data.error || 'Failed to fetch system health',
          response.status,
          'GET_HEALTH_ERROR',
          data
        );
      }
      return data.health;
    } catch (error) {
      console.error('Error fetching system health:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch system health',
        500,
        'GET_HEALTH_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get hourly analytics data
  async getHourlyAnalytics(): Promise<{ hour: number; count: number }[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/analytics/hourly`);
      const data = await response.json();
      
      if (!data.success || !data.hourlyData) {
        throw new ApiError(
          data.error || 'Failed to fetch hourly analytics',
          response.status,
          'GET_HOURLY_ANALYTICS_ERROR',
          data
        );
      }
      return data.hourlyData;
    } catch (error) {
      console.error('Error fetching hourly analytics:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch hourly analytics',
        500,
        'GET_HOURLY_ANALYTICS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get weekly analytics data
  async getWeeklyAnalytics(): Promise<{ totalEvents: number; dailyBreakdown: { date: string; count: number }[] }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/analytics/weekly`);
      const data = await response.json();
      
      if (!data.success || !data.weeklyData) {
        throw new ApiError(
          data.error || 'Failed to fetch weekly analytics',
          response.status,
          'GET_WEEKLY_ANALYTICS_ERROR',
          data
        );
      }
      return data.weeklyData;
    } catch (error) {
      console.error('Error fetching weekly analytics:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch weekly analytics',
        500,
        'GET_WEEKLY_ANALYTICS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get monthly analytics data
  async getMonthlyAnalytics(): Promise<{ totalEvents: number; weeklyBreakdown: { week: string; count: number }[] }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/analytics/monthly`);
      const data = await response.json();
      
      if (!data.success || !data.monthlyData) {
        throw new ApiError(
          data.error || 'Failed to fetch monthly analytics',
          response.status,
          'GET_MONTHLY_ANALYTICS_ERROR',
          data
        );
      }
      return data.monthlyData;
    } catch (error) {
      console.error('Error fetching monthly analytics:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch monthly analytics',
        500,
        'GET_MONTHLY_ANALYTICS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get response time analytics
  async getResponseTimeAnalytics(): Promise<{ average: number; recent: { timestamp: string; responseTime: number }[] }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/analytics/response-time`);
      const data = await response.json();
      
      if (!data.success || !data.responseTime) {
        throw new ApiError(
          data.error || 'Failed to fetch response time analytics',
          response.status,
          'GET_RESPONSE_TIME_ERROR',
          data
        );
      }
      return data.responseTime;
    } catch (error) {
      console.error('Error fetching response time analytics:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch response time analytics',
        500,
        'GET_RESPONSE_TIME_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;
