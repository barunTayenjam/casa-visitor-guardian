// Camera-related API methods extracted from ApiService.ts
import { Camera } from '@/types/security';
import { apiClient, fetchWithRetry, ApiError, NetworkError, API_URL } from './baseClient';

// ==================== TYPES ====================

interface BackendCamera {
  id: string;
  name: string;
  isActive: boolean;
  nightMode: boolean;
  status?: string;
  lastError?: string;
  retryCount?: number;
  config?: {
    detect: { width: number; height: number; fps: number };
    streams?: Array<{ path: string; roles: string[]; width: number; height: number; fps: number }>;
    objects?: { track: string[]; filters?: Record<string, { minArea?: number; maxArea?: number; threshold?: number }> };
    zones?: Array<{ id: string; name: string; coordinates: number[][]; objects?: string[]; inertia?: number; loiteringTime?: number }>;
  };
  streams?: {
    detect?: { isActive: boolean; fps: number; width: number; height: number; hasFrame: boolean; frameSize: number };
    record?: { isActive: boolean; fps: number; width: number; height: number };
  };
}

interface LegacyBackendCamera {
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
  status?: string;
  retryCount?: number;
}

interface MotionSettings {
  enabled: boolean;
  sensitivity: number;
  minArea: number;
  cooldownPeriod: number;
  ignoredZones: { x: number; y: number; width: number; height: number }[];
}

// ==================== HELPER ====================

function mapBackendToFrontendCamera(camera: BackendCamera | LegacyBackendCamera): Camera {
  const status = camera.status || (camera.isActive ? 'online' : 'offline');
  const isNewFormat = 'config' in camera && camera.config && camera.config.streams;

  let streamUrl: string | undefined;
  let resolution: string | undefined;
  let fps: number | undefined;

  if (isNewFormat && camera.config?.streams && camera.config.streams.length > 0) {
    streamUrl = camera.config.streams[0].path;
    resolution = `${camera.config.streams[0].width}x${camera.config.streams[0].height}`;
    fps = camera.config.streams[0].fps;
  } else {
    const legacyCamera = camera as LegacyBackendCamera;
    streamUrl = legacyCamera.rtspUrl;
    resolution = legacyCamera.resolution;
    fps = legacyCamera.frameRate;
  }

  return {
    id: camera.id,
    name: camera.name,
    status: status as 'online' | 'offline' | 'warning',
    streamUrl,
    thumbnail: '/placeholder-camera.svg',
    location: camera.name,
    detectionEnabled: true,
    sensitivity: 0.5,
    lastSeen: new Date(),
    resolution,
    fps,
    error: camera.lastError,
    config: isNewFormat ? camera.config : undefined,
    streams: (camera as BackendCamera).streams ? {
      detect: (camera as BackendCamera).streams!.detect,
      record: (camera as BackendCamera).streams!.record ? {
        ...(camera as BackendCamera).streams!.record,
        hasFrame: (camera as BackendCamera).streams!.record!.isActive,
        frameSize: 0,
      } : undefined,
    } : undefined,
  };
}

// ==================== CAMERA SERVICE ====================

export const cameraService = {
  async getCameras(): Promise<Camera[]> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras`);
      const data = await response.json();

      if (!data.success || !data.cameras) {
        throw new ApiError(data.error || 'Failed to fetch cameras', response.status, 'GET_CAMERAS_ERROR', data);
      }

      return data.cameras.map(mapBackendToFrontendCamera);
    } catch (error) {
      console.error('Error fetching cameras:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to fetch cameras', 500, 'GET_CAMERAS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getCamera(id: string): Promise<Camera> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${id}`);
      const data = await response.json();

      if (!data.success || !data.camera) {
        throw new ApiError(data.error || `Failed to fetch camera ${id}`, response.status, 'GET_CAMERA_ERROR', data);
      }

      return mapBackendToFrontendCamera(data.camera);
    } catch (error) {
      console.error(`Error fetching camera ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to fetch camera ${id}`, 500, 'GET_CAMERA_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async addCamera(camera: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>): Promise<string> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras`, {
        method: 'POST',
        body: JSON.stringify({
          name: camera.name,
          rtspUrl: camera.streamUrl,
          frameRate: camera.fps,
          resolution: camera.resolution,
          nightMode: false,
        }),
      });

      const data = await response.json();
      if (!data.success || !data.camera?.id) {
        throw new ApiError(data.error || 'Failed to add camera', response.status, 'ADD_CAMERA_ERROR', data);
      }
      return data.camera.id;
    } catch (error) {
      console.error('Error adding camera:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to add camera', 500, 'ADD_CAMERA_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async updateCamera(id: string, updates: Partial<Camera>): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...(updates.name && { name: updates.name }),
          ...(updates.streamUrl && { rtspUrl: updates.streamUrl }),
          ...(updates.fps && { frameRate: updates.fps }),
          ...(updates.resolution && { resolution: updates.resolution }),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to update camera ${id}`, response.status, 'UPDATE_CAMERA_ERROR', data);
      }
    } catch (error) {
      console.error(`Error updating camera ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to update camera ${id}`, 500, 'UPDATE_CAMERA_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async deleteCamera(id: string): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to delete camera ${id}`, response.status, 'DELETE_CAMERA_ERROR', data);
      }
    } catch (error) {
      console.error(`Error deleting camera ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to delete camera ${id}`, 500, 'DELETE_CAMERA_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getStreamStatus(cameraId: string): Promise<{
    isActive: boolean; fps: number; width: number; height: number; hasFrame: boolean; frameSize: number;
  }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/streams/${cameraId}/status`);
      const data = await response.json();
      if (!data.success || !data.stream) {
        throw new ApiError(data.error || `Failed to get stream status for camera ${cameraId}`, response.status, 'GET_STREAM_STATUS_ERROR', data);
      }
      return data.stream;
    } catch (error) {
      console.error(`Error getting stream status for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to get stream status for camera ${cameraId}`, 500, 'GET_STREAM_STATUS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async startCameraStream(id: string): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${id}/stream/start`, { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        if (data.error && data.error.includes('already streaming')) {
          console.log(`Camera ${id} is already streaming`);
          return;
        }
        throw new ApiError(data.error || `Failed to start camera stream ${id}`, response.status, 'START_STREAM_ERROR', data);
      }
    } catch (error) {
      console.error(`Error starting stream for camera ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to start camera stream ${id}`, 500, 'START_STREAM_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async stopCameraStream(id: string): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${id}/stream/stop`, { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to stop camera stream ${id}`, response.status, 'STOP_STREAM_ERROR', data);
      }
    } catch (error) {
      console.error(`Error stopping stream for camera ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to stop camera stream ${id}`, 500, 'STOP_STREAM_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async takeSnapshot(id: string, resolution?: string): Promise<string> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${id}/snapshot`, {
        method: 'POST',
        body: JSON.stringify({ resolution }),
      });
      const data = await response.json();
      if (!data.success || !data.url) {
        throw new ApiError(data.error || `Failed to take snapshot for camera ${id}`, response.status, 'SNAPSHOT_ERROR', data);
      }
      return data.url as string;
    } catch (error) {
      console.error(`Error taking snapshot for camera ${id}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to take snapshot for camera ${id}`, 500, 'SNAPSHOT_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async toggleNightMode(id: string, enabled: boolean): Promise<void> {
    try {
      await fetchWithRetry(`${API_URL}/cameras/${id}/night-mode`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
    } catch (error) {
      console.error(`Error toggling night mode for camera ${id}:`, error);
      throw error;
    }
  },

  async getMotionSettings(cameraId: string): Promise<MotionSettings> {
    try {
      const response = await fetchWithRetry(`${API_URL}/motion/${cameraId}/settings`);
      const data = await response.json();
      if (!data.success || !data.settings) {
        throw new ApiError(data.error || `Failed to get motion settings for camera ${cameraId}`, response.status, 'GET_MOTION_SETTINGS_ERROR', data);
      }
      return data.settings;
    } catch (error) {
      console.error(`Error fetching motion settings for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to get motion settings for camera ${cameraId}`, 500, 'GET_MOTION_SETTINGS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async updateMotionSettings(cameraId: string, settings: Partial<MotionSettings>): Promise<void> {
    try {
      const response = await fetchWithRetry(`${API_URL}/motion/${cameraId}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to update motion settings for camera ${cameraId}`, response.status, 'UPDATE_MOTION_SETTINGS_ERROR', data);
      }
    } catch (error) {
      console.error(`Error updating motion settings for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to update motion settings for camera ${cameraId}`, 500, 'UPDATE_MOTION_SETTINGS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getZones(cameraId: string): Promise<Array<{
    id: string; name: string; coordinates: number[][]; enabled: boolean; objects?: string[];
  }>> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/zones`);
      const data = await response.json();
      if (!data.success || !data.zones) {
        throw new ApiError(data.error || `Failed to get zones for camera ${cameraId}`, response.status, 'GET_ZONES_ERROR', data);
      }
      return data.zones;
    } catch (error) {
      console.error(`Error fetching zones for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to get zones for camera ${cameraId}`, 500, 'GET_ZONES_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async addZone(cameraId: string, zone: { name: string; coordinates: number[][]; objects?: string[] }): Promise<{ success: boolean; zone: { id: string; name: string } }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/zones`, {
        method: 'POST',
        body: JSON.stringify(zone),
      });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to add zone for camera ${cameraId}`, response.status, 'ADD_ZONE_ERROR', data);
      }
      return data;
    } catch (error) {
      console.error(`Error adding zone for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to add zone for camera ${cameraId}`, 500, 'ADD_ZONE_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async updateZone(cameraId: string, zoneId: string, updates: Partial<{ name: string; coordinates: number[][]; enabled: boolean; objects: string[] }>): Promise<{ success: boolean }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/zones/${zoneId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to update zone ${zoneId}`, response.status, 'UPDATE_ZONE_ERROR', data);
      }
      return data;
    } catch (error) {
      console.error(`Error updating zone ${zoneId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to update zone ${zoneId}`, 500, 'UPDATE_ZONE_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async deleteZone(cameraId: string, zoneId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/zones/${zoneId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to delete zone ${zoneId}`, response.status, 'DELETE_ZONE_ERROR', data);
      }
      return data;
    } catch (error) {
      console.error(`Error deleting zone ${zoneId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to delete zone ${zoneId}`, 500, 'DELETE_ZONE_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async getFilters(cameraId: string): Promise<{
    track: string[];
    filters: Record<string, { minArea?: number; maxArea?: number; threshold?: number }>;
  }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/filters`);
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to get filters for camera ${cameraId}`, response.status, 'GET_FILTERS_ERROR', data);
      }
      return { track: data.track || [], filters: data.filters || {} };
    } catch (error) {
      console.error(`Error fetching filters for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to get filters for camera ${cameraId}`, 500, 'GET_FILTERS_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async updateTrackList(cameraId: string, track: string[]): Promise<{ success: boolean; track: string[] }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/filters/track`, {
        method: 'PUT',
        body: JSON.stringify({ track }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to update track list for camera ${cameraId}`, response.status, 'UPDATE_TRACK_LIST_ERROR', data);
      }
      return data;
    } catch (error) {
      console.error(`Error updating track list for camera ${cameraId}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to update track list for camera ${cameraId}`, 500, 'UPDATE_TRACK_LIST_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async updateFilter(cameraId: string, label: string, filter: { minArea?: number; maxArea?: number; threshold?: number }): Promise<{ success: boolean }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/filters/${label}`, {
        method: 'PUT',
        body: JSON.stringify({ filter }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to update filter for ${label}`, response.status, 'UPDATE_FILTER_ERROR', data);
      }
      return data;
    } catch (error) {
      console.error(`Error updating filter for ${label}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to update filter for ${label}`, 500, 'UPDATE_FILTER_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async deleteFilter(cameraId: string, label: string): Promise<{ success: boolean }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${cameraId}/filters/${label}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) {
        throw new ApiError(data.error || `Failed to delete filter for ${label}`, response.status, 'DELETE_FILTER_ERROR', data);
      }
      return data;
    } catch (error) {
      console.error(`Error deleting filter for ${label}:`, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to delete filter for ${label}`, 500, 'DELETE_FILTER_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  async testCameraConnection(cameraData: { name: string; rtspUrl: string; username?: string; password?: string }): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
      const response = await fetchWithRetry(`${API_URL}/cameras/${encodeURIComponent(cameraData.name)}/stream/start-test`, {
        method: 'POST',
        body: JSON.stringify({ rtspUrl: cameraData.rtspUrl }),
      });
      const data = await response.json();
      return { success: data.success, message: data.message || 'Connection test initiated', latency: data.latency };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to test camera connection', 500, 'TEST_CAMERA_CONNECTION_ERROR', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },
};
