import { Camera } from '@/types/security';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
}

// Type for motion detection settings
interface MotionSettings {
  enabled: boolean;
  sensitivity: number;
  minArea: number;
  cooldownPeriod: number;
  ignoredZones: { x: number; y: number; width: number; height: number }[];
}

// Type for motion events
interface MotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  boundingBoxes?: { x: number; y: number; width: number; height: number }[];
}

class ApiService {
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
      fps: camera.frameRate
    };
  }

  // Fetch all cameras
  async getCameras(): Promise<Camera[]> {
    try {
      const response = await fetch(`${API_URL}/cameras`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cameras: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Convert to frontend camera format
      return data.cameras.map(this.mapBackendToFrontendCamera);
    } catch (error) {
      console.error('Error fetching cameras:', error);
      throw error;
    }
  }

  // Get a single camera by ID
  async getCamera(id: string): Promise<Camera> {
    try {
      const response = await fetch(`${API_URL}/cameras/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch camera: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.mapBackendToFrontendCamera(data.camera);
    } catch (error) {
      console.error(`Error fetching camera ${id}:`, error);
      throw error;
    }
  }

  // Add a new camera
  async addCamera(camera: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>): Promise<string> {
    try {
      const response = await fetch(`${API_URL}/cameras`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
      
      if (!response.ok) {
        throw new Error(`Failed to add camera: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.cameraId;
    } catch (error) {
      console.error('Error adding camera:', error);
      throw error;
    }
  }

  // Update a camera
  async updateCamera(id: string, updates: Partial<Camera>): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/cameras/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...(updates.name && { name: updates.name }),
          ...(updates.streamUrl && { rtspUrl: updates.streamUrl }),
          ...(updates.fps && { frameRate: updates.fps }),
          ...(updates.resolution && { resolution: updates.resolution })
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update camera: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error updating camera ${id}:`, error);
      throw error;
    }
  }

  // Delete a camera
  async deleteCamera(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/cameras/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete camera: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error deleting camera ${id}:`, error);
      throw error;
    }
  }

  // Start streaming from a camera
  async startCameraStream(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/cameras/${id}/stream/start`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start stream: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error starting stream for camera ${id}:`, error);
      throw error;
    }
  }

  // Stop streaming from a camera
  async stopCameraStream(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/cameras/${id}/stream/stop`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to stop stream: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error stopping stream for camera ${id}:`, error);
      throw error;
    }
  }

  // Take a snapshot from a camera
  async takeSnapshot(id: string, resolution?: string): Promise<string> {
    try {
      const response = await fetch(`${API_URL}/cameras/${id}/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolution })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to take snapshot: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.snapshotPath;
    } catch (error) {
      console.error(`Error taking snapshot for camera ${id}:`, error);
      throw error;
    }
  }

  // Toggle night mode for a camera
  async toggleNightMode(id: string, enabled: boolean): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/cameras/${id}/night-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle night mode: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error toggling night mode for camera ${id}:`, error);
      throw error;
    }
  }

  // Get motion detection settings for a camera
  async getMotionSettings(cameraId: string): Promise<MotionSettings> {
    try {
      const response = await fetch(`${API_URL}/motion/${cameraId}/settings`);
      if (!response.ok) {
        throw new Error(`Failed to fetch motion settings: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.settings;
    } catch (error) {
      console.error(`Error fetching motion settings for camera ${cameraId}:`, error);
      throw error;
    }
  }

  // Update motion detection settings for a camera
  async updateMotionSettings(cameraId: string, settings: Partial<MotionSettings>): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/motion/${cameraId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update motion settings: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error updating motion settings for camera ${cameraId}:`, error);
      throw error;
    }
  }

  // Get recent motion events
  async getMotionEvents(limit = 20): Promise<MotionEvent[]> {
    try {
      const response = await fetch(`${API_URL}/motion/events?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch motion events: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.events;
    } catch (error) {
      console.error('Error fetching motion events:', error);
      throw error;
    }
  }

  // Get motion events for a specific camera
  async getCameraMotionEvents(cameraId: string, limit = 20): Promise<MotionEvent[]> {
    try {
      const response = await fetch(`${API_URL}/motion/${cameraId}/events?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch camera motion events: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.events;
    } catch (error) {
      console.error(`Error fetching motion events for camera ${cameraId}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;
