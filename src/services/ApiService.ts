import { Camera, MotionEvent } from '@/types/security';

// API URLs - use relative URLs in both dev and production since nginx handles proxying
const API_URL = '/api';
const BACKEND_URL = '';

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

// NEW: Detection data types for enhanced events
export interface DetectionData {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface FaceDetectionData {
  id: string;
  name: string;
  isKnown: boolean;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface EnhancedEvent {
  id: string;
  event_type: string;
  filename: string;
  timestamp: Date;
  cameraId: string;
  confidence: number;
  metadata: any;
  
  // NEW: Detection data
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  unknown_faces_count: number;
  object_detections: DetectionData[] | null;
  face_detections: FaceDetectionData[] | null;
}

interface EnhancedEventsResponse {
  success: boolean;
  events: EnhancedEvent[];
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

interface SystemSettings {
  general: GeneralSettings;
  storage: StorageSettings;
  notifications: NotificationSettings;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
}

interface BackendMotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  cameraName?: string;
  labels?: string[];
  location?: string;
  archived?: boolean;
}

// ==================== BATCH PROCESSING TYPES ====================

interface BatchTimeRange {
  label: string;
  value: {
    start: Date | string;
    end: Date | string;
  };
}

interface BatchJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    currentFile?: string;
  };
  options: {
    timeRange: {
      start: string;
      end: string;
    };
    cameraIds?: string[];
    detectionTypes: ('person' | 'face' | 'both')[];
    confidenceThreshold: number;
    saveResults: boolean;
    outputFormat: 'json' | 'csv' | 'database';
  };
  results?: {
    totalImages: number;
    personDetections: number;
    faceDetections: number;
    processingTime: number;
  };
  error?: string;
}

interface BatchProcessingOptions {
  timeRange: {
    start: string;
    end: string;
  };
  cameraIds?: string[];
  detectionTypes: ('person' | 'face' | 'both')[];
  confidenceThreshold: number;
  saveResults: boolean;
  outputFormat: 'json' | 'csv' | 'database';
}

interface BatchResults {
  jobId: string;
  timestamp: string;
  options: BatchProcessingOptions;
  summary: {
    totalImages: number;
    personDetections: number;
    faceDetections: number;
    knownFaces: number;
    unknownFaces: number;
    processingTime?: number;
  };
  results: BatchResult[];
}

interface BatchResult {
  filename: string;
  timestamp: string;
  cameraId: string;
  persons: Array<{
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  faces: Array<{
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    personId?: string;
    personName?: string;
    isKnown?: boolean;
  }>;
}

interface BatchStats {
  total: number;
  completed: number;
  running: number;
  queued: number;
  failed: number;
  cancelled: number;
  totalProcessingTime: number;
  totalPersonDetections: number;
  totalFaceDetections: number;
  recentJobs: number;
}

interface BatchAvailableEvent {
  filename: string;
  timestamp: string;
  cameraId: string;
  size: number;
}

// ==================== DETECTION TYPES ====================

interface DetectionFilters {
  startTime?: string;
  endTime?: string;
  cameraIds?: string[];
  detectionTypes?: ('person' | 'face' | 'object')[];
  minConfidence?: number;
  maxConfidence?: number;
  limit?: number;
  offset?: number;
}

interface DetectionEvent {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName?: string;
  imagePath: string;
  detectionType: 'person' | 'face' | 'object';
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  className?: string;
  personName?: string;
  isKnown?: boolean;
  metadata?: Record<string, any>;
}

class ApiService {
  private authToken: string | null = null;

  // Set authentication token
  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  // Get authentication token
  getAuthToken(): string | null {
    return this.authToken;
  }

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
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        let errorDetails: Record<string, unknown> = {};
        
        // Special handling for rate limiting
        if (response.status === 429) {
          errorMessage = `Too many API requests, please try again later`;
          throw new ApiError(errorMessage, response.status, errorMessage);
        }
        
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
        
        // Special handling for rate limiting (429)
        if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          console.log('Rate limit detected, waiting longer before retry...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for rate limiting
        } else if (error.message.includes('ECONNRESET') || error.message.includes('fetch')) {
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

    async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    let url = `${API_URL}${endpoint}`;
    if (params) {
      const urlParams = new URLSearchParams(params as Record<string, string>);
      url += `?${urlParams.toString()}`;
    }
    const response = await this.fetchWithRetry(url);
    return response.json();
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const response = await this.fetchWithRetry(`${API_URL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
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
      thumbnail: undefined, // Will be loaded dynamically
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

  // Get recent motion events
  async getMotionEvents(limit = 100): Promise<MotionEvent[]> {
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
      const transformedEvents: MotionEvent[] = data.events.map((event: BackendMotionEvent) => {
        // Use the full imagePath from API (e.g., "/public/snapshots/cam1_motion_1.jpg")
        // getEventImageUrl will handle the path cleaning
        return {
          id: event.id,
          cameraId: event.cameraId,
          cameraName: cameraMap.get(event.cameraId) || `Camera ${event.cameraId}`,
          timestamp: new Date(event.timestamp),
          imageUrl: event.imagePath ? this.getEventImageUrl(event.imagePath) : null, // Use full path
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

  // NEW: Fetch enhanced events list with detection data
  async getEnhancedEventsList(options?: {
    limit?: number;
    event_type?: string;
    camera_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<EnhancedEventsResponse> {
    try {
      const params = new URLSearchParams(options as any);
      const response = await this.fetchWithRetry(`${API_URL}/events/list-enhanced?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to fetch enhanced events list',
          response.status,
          'GET_ENHANCED_EVENTS_ERROR',
          data
        );
      }
      return data;
    } catch (error) {
      console.error('Error fetching enhanced events list:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch enhanced events list',
        500,
        'GET_ENHANCED_EVENTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // NEW: Get event details with detection data
  async getEventDetails(eventId: string): Promise<{ success: boolean; event: EnhancedEvent }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/events/${eventId}/details`);
      const data = await response.json();
      
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to fetch event details',
          response.status,
          'GET_EVENT_DETAILS_ERROR',
          data
        );
      }
      return data;
    } catch (error) {
      console.error('Error fetching event details:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to fetch event details',
        500,
        'GET_EVENT_DETAILS_ERROR',
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
    
    // Handle full paths from API (e.g., "/public/snapshots/cam1_motion_1.jpg")
    // or just filenames (e.g., "cam1_motion_1.jpg")
    let cleanFilename = filename;
    
    // Remove leading slashes and /public/ prefix if present
    cleanFilename = cleanFilename.replace(/^\/+/, '');
    cleanFilename = cleanFilename.replace(/^public\//, '');
    
    // For Docker environment, use the same host and port as the current page
    // The backend serves static files at /events and /snapshots endpoints
    const currentHost = window.location.host;
    const protocol = window.location.protocol;
    
    // If the filename already starts with events/ or snapshots/, use it directly
    // Otherwise, assume it's in the events directory
    const imagePath = cleanFilename.startsWith('events/') || cleanFilename.startsWith('snapshots/') 
      ? cleanFilename 
      : `events/${cleanFilename}`;
    
    return `${protocol}//${currentHost}/${imagePath}`;
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
    
    // Handle full paths from API (e.g., "/public/snapshots/cam1_motion_1.jpg")
    // or just filenames (e.g., "cam1_motion_1.jpg")
    let cleanFilename = filename;
    
    // Remove leading slashes and /public/ prefix if present
    cleanFilename = cleanFilename.replace(/^\/+/, '');
    cleanFilename = cleanFilename.replace(/^public\//, '');
    
    // For Docker environment, use the same host and port as the current page
    const currentHost = window.location.host;
    const protocol = window.location.protocol;
    
    // If the filename already starts with snapshots/, use it directly
    // Otherwise, assume it's in the snapshots directory
    const imagePath = cleanFilename.startsWith('snapshots/') 
      ? cleanFilename 
      : `snapshots/${cleanFilename}`;
    
    return `${protocol}//${currentHost}/${imagePath}`;
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

  // Authentication methods
  async login(username: string, password: string) {
    const response = await this.fetchWithRetry(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return response.json();
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'user' | 'viewer';
  }) {
    const response = await this.fetchWithRetry(`${API_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return response.json();
  }

  async getProfile() {
    const response = await this.fetchWithRetry(`${API_URL}/auth/profile`);
    return response.json();
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.fetchWithRetry(`${API_URL}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.json();
  }

  async refreshToken() {
    const response = await this.fetchWithRetry(`${API_URL}/auth/refresh`, {
      method: 'POST',
    });
    return response.json();
  }

  async logout() {
    const response = await this.fetchWithRetry(`${API_URL}/auth/logout`, {
      method: 'POST',
    });
    return response.json();
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
    sortBy?: string;
    detectionType?: 'all' | 'face' | 'person' | 'motion';
  }): Promise<HistoricalEventsResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
      if (options?.cameraId) params.append('cameraId', options.cameraId);
      if (options?.searchQuery) params.append('searchQuery', options.searchQuery);
      if (options?.startDate) params.append('startDate', options.startDate.toISOString());
      if (options?.endDate) params.append('endDate', options.endDate.toISOString());
      if (options?.sortBy) params.append('sortBy', options.sortBy);
      if (options?.detectionType && options.detectionType !== 'all') params.append('detectionType', options.detectionType);

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
      const transformedEvents: MotionEvent[] = data.events.map((event: BackendMotionEvent) => ({
        ...event,
        timestamp: new Date(event.timestamp),
        imageUrl: event.imagePath ? this.getEventImageUrl(event.imagePath) : null,
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

  // =====================================
  // PERSON AND FACIAL DETECTION METHODS
  // =====================================

  // Trigger person detection for a camera
  async triggerPersonDetection(cameraId: string): Promise<{
    persons: number;
    detections: any[];
    timestamp: string;
  }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/person/${cameraId}/trigger`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to trigger person detection for camera ${cameraId}`,
          response.status,
          'TRIGGER_PERSON_DETECTION_ERROR',
          data
        );
      }
      return data;
    } catch (error) {
      console.error(`Error triggering person detection for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to trigger person detection for camera ${cameraId}`,
        500,
        'TRIGGER_PERSON_DETECTION_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Trigger facial detection for a camera
  async triggerFaceDetection(cameraId: string): Promise<{
    faces: number;
    knownFaces: number;
    unknownFaces: number;
    detections: any[];
    timestamp: string;
  }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/face/${cameraId}/trigger`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to trigger face detection for camera ${cameraId}`,
          response.status,
          'TRIGGER_FACE_DETECTION_ERROR',
          data
        );
      }
      return data;
    } catch (error) {
      console.error(`Error triggering face detection for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to trigger face detection for camera ${cameraId}`,
        500,
        'TRIGGER_FACE_DETECTION_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get person detection settings
  async getPersonDetectionSettings(): Promise<any> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/person/settings`);
      const data = await response.json();
      
      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || 'Failed to get person detection settings',
          response.status,
          'GET_PERSON_DETECTION_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error('Error getting person detection settings:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get person detection settings',
        500,
        'GET_PERSON_DETECTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Update person detection settings
  async updatePersonDetectionSettings(settings: {
    detectClasses?: string[];
    confidenceThreshold?: number;
    maxDetections?: number;
  }): Promise<any> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/person/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      
      const data = await response.json();
      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || 'Failed to update person detection settings',
          response.status,
          'UPDATE_PERSON_DETECTION_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error('Error updating person detection settings:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to update person detection settings',
        500,
        'UPDATE_PERSON_DETECTION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get facial recognition settings
  async getFacialRecognitionSettings(): Promise<any> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/face/settings`);
      const data = await response.json();
      
      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || 'Failed to get facial recognition settings',
          response.status,
          'GET_FACIAL_RECOGNITION_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error('Error getting facial recognition settings:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get facial recognition settings',
        500,
        'GET_FACIAL_RECOGNITION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Update facial recognition settings
  async updateFacialRecognitionSettings(settings: {
    recognitionThreshold?: number;
    minFaceSize?: number;
    livenessDetection?: boolean;
  }): Promise<any> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/face/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      
      const data = await response.json();
      if (!data.success || !data.settings) {
        throw new ApiError(
          data.error || 'Failed to update facial recognition settings',
          response.status,
          'UPDATE_FACIAL_RECOGNITION_SETTINGS_ERROR',
          data
        );
      }
      return data.settings;
    } catch (error) {
      console.error('Error updating facial recognition settings:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to update facial recognition settings',
        500,
        'UPDATE_FACIAL_RECOGNITION_SETTINGS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get known persons for facial recognition
  async getKnownPersons(): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/face/persons`);
      const data = await response.json();
      
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to get known persons',
          response.status,
          'GET_KNOWN_PERSONS_ERROR',
          data
        );
      }
      return data.persons || [];
    } catch (error) {
      console.error('Error getting known persons:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get known persons',
        500,
        'GET_KNOWN_PERSONS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Add a known person for facial recognition
  async addKnownPerson(personData: {
    name: string;
    description?: string;
    imagePaths: string[];
  }): Promise<{ personId: string; message: string }> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/detection/face/persons`, {
        method: 'POST',
        body: JSON.stringify(personData)
      });
      
      const data = await response.json();
      if (!data.success || !data.personId) {
        throw new ApiError(
          data.error || 'Failed to add known person',
          response.status,
          'ADD_KNOWN_PERSON_ERROR',
          data
        );
      }
      return { personId: data.personId, message: data.message };
    } catch (error) {
      console.error('Error adding known person:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to add known person',
        500,
        'ADD_KNOWN_PERSON_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Get detection events
  async getDetectionEvents(options?: {
    limit?: number;
    type?: 'person' | 'face';
  }): Promise<{ events: any[]; timestamp: string }> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.type) params.append('type', options.type);
      
      const response = await this.fetchWithRetry(`${API_URL}/detection/events?${params.toString()}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new ApiError(
          data.error || 'Failed to get detection events',
          response.status,
          'GET_DETECTION_EVENTS_ERROR',
          data
        );
      }
      return data;
    } catch (error) {
      console.error('Error getting detection events:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Failed to get detection events',
        500,
        'GET_DETECTION_EVENTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Analyze motion with person/face detection
  async analyzeMotionWithDetection(cameraId: string, options: {
    enablePersonDetection?: boolean;
    enableFaceDetection?: boolean;
  }): Promise<any> {
    try {
      const response = await this.fetchWithRetry(`${API_URL}/motion/${cameraId}/analyze`, {
        method: 'POST',
        body: JSON.stringify(options)
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(
          data.error || `Failed to analyze motion for camera ${cameraId}`,
          response.status,
          'ANALYZE_MOTION_ERROR',
          data
        );
      }
      return data.analysis;
    } catch (error) {
      console.error(`Error analyzing motion for camera ${cameraId}:`, error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to analyze motion for camera ${cameraId}`,
        500,
        'ANALYZE_MOTION_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ==================== BATCH PROCESSING API ====================

  /**
   * Get available time ranges for batch processing
   */
  async getBatchTimeRanges(): Promise<BatchTimeRange[]> {
    try {
      const response = await this.get<{ success: boolean; ranges: BatchTimeRange[] }>('/batch/time-ranges');
      if (response.success) {
        return response.ranges;
      }
      throw new ApiError('Failed to get time ranges', 400, 'GET_TIME_RANGES_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to get time ranges',
        500,
        'GET_TIME_RANGES_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get all batch processing jobs
   */
  async getBatchJobs(): Promise<BatchJob[]> {
    try {
      const response = await this.get<{ success: boolean; jobs: BatchJob[] }>('/batch/jobs');
      if (response.success) {
        return response.jobs;
      }
      throw new ApiError('Failed to get batch jobs', 400, 'GET_BATCH_JOBS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to get batch jobs',
        500,
        'GET_BATCH_JOBS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Start batch processing job
   */
  async startBatchProcessing(options: BatchProcessingOptions): Promise<string> {
    try {
      const response = await this.post<{ success: boolean; jobId: string }>('/batch/start', options);
      if (response.success) {
        return response.jobId;
      }
      throw new ApiError('Failed to start batch processing', 400, 'START_BATCH_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to start batch processing',
        500,
        'START_BATCH_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Cancel batch processing job
   */
  async cancelBatchJob(jobId: string): Promise<boolean> {
    try {
      const response = await this.post<{ success: boolean }>(`/batch/jobs/${jobId}/cancel`);
      return response.success;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Failed to cancel batch job ${jobId}`,
        500,
        'CANCEL_BATCH_JOB_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get batch processing job results
   */
  async getBatchResults(jobId: string): Promise<BatchResults> {
    try {
      const response = await this.get<{ success: boolean; results: BatchResults }>(`/batch/jobs/${jobId}/results`);
      if (response.success) {
        return response.results;
      }
      throw new ApiError('Failed to get batch results', 400, 'GET_BATCH_RESULTS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Failed to get batch results for job ${jobId}`,
        500,
        'GET_BATCH_RESULTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get batch processing statistics
   */
  async getBatchStats(): Promise<BatchStats> {
    try {
      const response = await this.get<{ success: boolean; stats: BatchStats }>('/batch/stats');
      if (response.success) {
        return response.stats;
      }
      throw new ApiError('Failed to get batch stats', 400, 'GET_BATCH_STATS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to get batch stats',
        500,
        'GET_BATCH_STATS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get available events for batch processing
   */
  async getBatchAvailableEvents(params: {
    startTime: string;
    endTime: string;
    cameraIds?: string[];
  }): Promise<BatchAvailableEvent[]> {
    try {
      const response = await this.get<{ success: boolean; events: BatchAvailableEvent[] }>('/batch/events/available', params);
      if (response.success) {
        return response.events;
      }
      throw new ApiError('Failed to get available events', 400, 'GET_AVAILABLE_EVENTS_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to get available events',
        500,
        'GET_AVAILABLE_EVENTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Download batch processing results
   */
  async downloadBatchResults(jobId: string): Promise<void> {
    try {
      window.open(`/api/batch/jobs/${jobId}/download`, '_blank');
    } catch (error) {
      throw new ApiError(
        `Failed to download batch results for job ${jobId}`,
        500,
        'DOWNLOAD_BATCH_RESULTS_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ==================== DETECTION HISTORY API ====================

  /**
   * Get detection history with filters
   */
  async getDetectionHistory(filters: DetectionFilters): Promise<DetectionEvent[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters.detectionTypes && filters.detectionTypes.length > 0) {
        queryParams.append('type', filters.detectionTypes[0]);
      }
      if (filters.cameraIds && filters.cameraIds.length > 0) {
        queryParams.append('cameraId', filters.cameraIds[0]);
      }
      if (filters.limit) {
        queryParams.append('limit', filters.limit.toString());
      }

      const response = await this.get<{ success: boolean; events: DetectionEvent[] }>(`/detection/events?${queryParams.toString()}`);
      if (response.success) {
        return response.events;
      }
      throw new ApiError('Failed to get detection history', 400, 'GET_DETECTION_HISTORY_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Failed to get detection history',
        500,
        'GET_DETECTION_HISTORY_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get detection image with overlays
   */
  async getDetectionImage(imageId: string, includeOverlays: boolean = true): Promise<string> {
    try {
      const response = await this.get<{ success: boolean; imageUrl: string }>(`/detections/image/${imageId}`, {
        overlays: includeOverlays
      });
      if (response.success) {
        return response.imageUrl;
      }
      throw new ApiError('Failed to get detection image', 400, 'GET_DETECTION_IMAGE_ERROR');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Failed to get detection image ${imageId}`,
        500,
        'GET_DETECTION_IMAGE_ERROR',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;
