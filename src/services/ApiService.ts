import { Camera, MotionEvent } from '@/types/security';

// API URLs are now relative in development mode since we use Vite's proxy
const isDev = import.meta.env.DEV;
const API_URL = isDev ? '/api' : '/api'; // Always use relative URLs, nginx will proxy
const BACKEND_URL = isDev ? '' : ''; // Always use relative URLs in production

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

// Type for person detection settings
interface PersonDetectionSettings {
  enabled: boolean;
  minConfidence: number; // 0-1, threshold for person detection
  cooldownPeriod: number; // milliseconds
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
  status?: string; // Status field from backend
  retryCount?: number;
}

interface Alert {
  id: string;
  type: 'motion' | 'camera' | 'system';
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string; // Changed to string for API response
  acknowledged: boolean;
  cameraId?: string;
}

interface PaginationInfo {
  totalEvents: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface HistoricalEventsResponse {
  events: MotionEvent[];
  pagination: PaginationInfo;
}

interface GeneralSettings {
  systemName: string;
  timezone: string;
  language: string;
  theme: string;
  autoBackup: boolean;
  backupFrequency: string;
}

interface StorageSettings {
  retentionDays: number;
  maxStorageGB: number;
  autoCleanup: boolean;
  compressionEnabled: boolean;
  compressionQuality: number;
}

interface NotificationSettings {
  emailEnabled: boolean;
  emailAddress: string;
  pushEnabled: boolean;
  pushSoundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface DetectionSettings {
  personDetectionEnabled: boolean;
  personDetectionConfidence: number;
  motionDetectionEnabled: boolean;
  motionDetectionSensitivity: number;
}

interface SystemSettings {
  general: GeneralSettings;
  storage: StorageSettings;
  notifications: NotificationSettings;
  detection: DetectionSettings;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: Record<string, any>;
}

export class ApiService {
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
    // Use the status from backend if available, otherwise derive from isActive
    const status = camera.status || (camera.isActive ? 'online' : 'offline');
    
    return {
      id: camera.id,
      name: camera.name,
      status: status as 'online' | 'offline' | 'warning',
      streamUrl: camera.rtspUrl,
      thumbnail: '/placeholder-camera.svg',
      location: camera.name, // Use camera name as location for now
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

  // Get person detection settings for a camera
  async getPersonDetectionSettings(cameraId: string): Promise<PersonDetectionSettings> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/person/${cameraId}/settings`);
      const data = await response.json();
      
      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || `Failed to get person detection settings for camera ${cameraId}`,
          response.status,
          'GET_PERSON_DETECTION_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error(`Error fetching person detection settings for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to get person detection settings for camera ${cameraId}`,
        500,
        'GET_PERSON_DETECTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Update person detection settings for a camera
  async updatePersonDetectionSettings(cameraId: string, settings: Partial<PersonDetectionSettings>): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/person/${cameraId}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to update person detection settings for camera ${cameraId}`,
          response.status,
          'UPDATE_PERSON_DETECTION_SETTINGS_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error updating person detection settings for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to update person detection settings for camera ${cameraId}`,
        500,
        'UPDATE_PERSON_DETECTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Analyze saved images and organize into person folders
  async analyzePersons(): Promise<{
    result: {
      totalImages: number;
      processedImages: number;
      personsIdentified: number;
    };
    persons: {
      personId: string;
      imageCount: number;
      firstSeen: string;
      lastSeen: string;
    }[];
  }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/analyze-persons`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to analyze persons',
          response.status,
          'ANALYZE_PERSONS_ERROR',
          data
        );
      }
      
      return {
        result: data.result,
        persons: data.persons
      };
    } catch (error) {
      console.error('Error analyzing persons:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to analyze persons',
        500,
        'ANALYZE_PERSONS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Scan snapshots for persons
  async scanSnapshotsForPersons(): Promise<any> {
    const response = await this.fetchWithRetry(`${API_URL}/scan-snapshots-for-persons`, {
      method: 'POST'
    });
    return response.json();
  }

  // Get recent motion events
  async getMotionEvents(limit = 100): Promise<MotionEvent[]> {
    try {
      console.log(`Fetching motion events from ${API_URL}/motion/events?limit=${limit}`);
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

      // Get cameras to map camera names - but handle errors gracefully
      let cameraMap = new Map<string, string>();
      try {
        const cameras = await this.getCameras();
        cameraMap = new Map(cameras.map(c => [c.id, c.name]));
      } catch (error) {
        console.warn('Failed to fetch cameras for name mapping:', error);
        // Continue without camera names
      }

      // Transform backend events to frontend format
      const transformedEvents: MotionEvent[] = data.events.map((event: any) => { // Use 'any' for incoming event to handle potential backend variations
        const filename = event.imagePath?.replace('/events/', '') || '';
        return {
          id: event.id,
          cameraId: event.cameraId,
          cameraName: cameraMap.get(event.cameraId) || `Camera ${event.cameraId}`,
          timestamp: new Date(event.timestamp),
          imageUrl: filename ? this.getEventImageUrl(filename) : null, // Ensure null if no image
          confidence: event.confidence || 0,
          labels: Array.isArray(event.labels) && event.labels.length > 0 ? event.labels : ['motion'], // Use backend labels if available
          location: cameraMap.get(event.cameraId) || `Camera ${event.cameraId}`,
          duration: event.duration || 0,
          archived: event.archived || false // Use backend archived status if available
        };
      });

      return transformedEvents;
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
    // Use relative URLs in production so nginx can proxy them correctly
    // In development, Vite's proxy will handle the routing
    const url = `/events/${filename}`;
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
    // Use relative URLs in production so nginx can proxy them correctly
    // In development, Vite's proxy will handle the routing
    const url = `/snapshots/${filename}`;
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

  // Get system logs
  async getSystemLogs(level?: string, limit?: number): Promise<LogEntry[]> {
    try {
      const params = new URLSearchParams();
      if (level) params.append('level', level);
      if (limit) params.append('limit', limit.toString());
      
      const response = await this.fetchWithRetry(`${API_URL}/system/logs?${params}`);
      const data = await response.json();
      
      if (!data.success || !data.logs) {
        throw new ApiError(
          data.error || 'Failed to fetch system logs',
          response.status,
          'GET_SYSTEM_LOGS_ERROR',
          data
        );
      }
      return data.logs;
    } catch (error) {
      console.error('Error fetching system logs:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch system logs',
        500,
        'GET_SYSTEM_LOGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Clear system logs
  async clearSystemLogs(): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/system/logs`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to clear system logs',
          response.status,
          'CLEAR_SYSTEM_LOGS_ERROR',
          data
        );
      }
    } catch (error) {
      console.error('Error clearing system logs:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to clear system logs',
        500,
        'CLEAR_SYSTEM_LOGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get system settings
  async getSystemSettings(): Promise<SystemSettings> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/settings`);
      const data = await response.json();

      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || 'Failed to fetch system settings',
          response.status,
          'GET_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error('Error fetching system settings:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch system settings',
        500,
        'GET_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Update system settings
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || 'Failed to update system settings',
          response.status,
          'UPDATE_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error('Error updating system settings:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to update system settings',
        500,
        'UPDATE_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get alerts
  async getAlerts(): Promise<Alert[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/alerts`);
      const data = await response.json();

      if (!data.success || !data.alerts) {
        throw new ApiError(
          data.error || 'Failed to fetch alerts',
          response.status,
          'GET_ALERTS_ERROR',
          data
        );
      }
      // Convert timestamp strings back to Date objects
      return data.alerts.map((alert: Alert) => ({
        ...alert,
        timestamp: new Date(alert.timestamp),
      }));
    } catch (error) {
      console.error('Error fetching alerts:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch alerts',
        500,
        'GET_ALERTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Acknowledge an alert
  async acknowledgeAlert(id: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/alerts/${id}/acknowledge`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to acknowledge alert ${id}`,
          response.status,
          'ACKNOWLEDGE_ALERT_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error acknowledging alert ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to acknowledge alert ${id}`,
        500,
        'ACKNOWLEDGE_ALERT_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Delete an alert
  async deleteAlert(id: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/alerts/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to delete alert ${id}`,
          response.status,
          'DELETE_ALERT_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error deleting alert ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to delete alert ${id}`,
        500,
        'DELETE_ALERT_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get historical events
  async getHistoricalEvents(options?: {
    page?: number;
    pageSize?: number;
    cameraId?: string;
    searchQuery?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<HistoricalEventsResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
      if (options?.cameraId) params.append('cameraId', options.cameraId);
      if (options?.searchQuery) params.append('searchQuery', options.searchQuery);
      if (options?.startDate) params.append('startDate', options.startDate.toISOString());
      if (options?.endDate) params.append('endDate', options.endDate.toISOString());

      const response = await this.fetchWithRetry(`${API_URL}/events/history?${params.toString()}`);
      const data = await response.json();

      if (!data.success || !data.events || !data.pagination) {
        throw new ApiError(
          data.error || 'Failed to fetch historical events',
          response.status,
          'GET_HISTORICAL_EVENTS_ERROR',
          data
        );
      }

      // Convert timestamp strings back to Date objects
      const transformedEvents: MotionEvent[] = data.events.map((event: any) => ({
        ...event,
        timestamp: new Date(event.timestamp),
        imageUrl: event.imagePath ? this.getEventImageUrl(event.imagePath.replace('/events/', '')) : null,
      }));

      return { events: transformedEvents, pagination: data.pagination };
    } catch (error) {
      console.error('Error fetching historical events:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch historical events',
        500,
        'GET_HISTORICAL_EVENTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Archive an event
  async archiveEvent(id: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/events/${id}/archive`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to archive event ${id}`,
          response.status,
          'ARCHIVE_EVENT_ERROR',
          data
        );
      }
    } catch (error) {
      console.error(`Error archiving event ${id}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to archive event ${id}`,
        500,
        'ARCHIVE_EVENT_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;
