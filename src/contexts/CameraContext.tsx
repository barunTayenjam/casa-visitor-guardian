
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Camera, MotionEvent as SecurityMotionEvent } from '@/types/security';
import apiService from '@/services/ApiService';
import socketService from '@/services/SocketService';
import { logger } from '@/lib/logger';

interface CameraContextType {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  addCamera: (camera: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>) => Promise<string>;
  updateCamera: (id: string, updates: Partial<Camera>) => Promise<void>;
  deleteCamera: (id: string) => Promise<void>;
  getCameraById: (id: string) => Camera | undefined;
  refreshCameras: () => Promise<void>;
  startCameraStream: (id: string) => Promise<void>;
  stopCameraStream: (id: string) => Promise<void>;
  takeSnapshot: (id: string, resolution?: string) => Promise<string>;
  toggleNightMode: (id: string, enabled: boolean) => Promise<void>;
  toggleMotionDetection: (id: string, enabled: boolean) => Promise<void>;
}

interface CameraMotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const useCameras = () => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error('useCameras must be used within a CameraProvider');
  }
  return context;
};

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Update a camera's last seen timestamp
  const updateCameraLastSeen = (id: string) => {
    setCameras(prev => prev.map(camera => 
      camera.id === id ? { ...camera, lastSeen: new Date() } : camera
    ));
  };

  // Update camera status locally (for socket events)
  const updateCameraStatus = (id: string, status: 'online' | 'offline') => {
    setCameras(prev => prev.map(camera => 
      camera.id === id ? { ...camera, status } : camera
    ));
  };

  // Refresh cameras from the backend
  const refreshCameras = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Fetching cameras from backend', 'CAMERA');
      const fetchedCameras = await apiService.getCameras();
      logger.info('Successfully fetched cameras', 'CAMERA', { 
        cameraCount: fetchedCameras.length 
      });
      
      setCameras(fetchedCameras);
    } catch (err) {
      logger.error('Failed to fetch cameras', 'CAMERA', err);
      setError('Failed to load cameras from the server');
      
      // Provide mock cameras only in development when backend is completely unavailable
      if (import.meta.env.DEV && err instanceof Error && err.message.includes('fetch')) {
        logger.info('Backend not available, providing mock cameras for development', 'CAMERA');
        const mockCameras: Camera[] = [
          {
            id: 'cam1',
            name: 'Front Door',
            status: 'online',
            streamUrl: 'rtsp://192.168.31.62:554/stream1',
            thumbnail: '/placeholder-camera.svg',
            location: 'Front Entrance',
            detectionEnabled: true,
            sensitivity: 0.7,
            lastSeen: new Date(),
            resolution: '2560x1440',
            fps: 15
          },
          {
            id: 'cam2',
            name: 'Back Door',
            status: 'online',
            streamUrl: 'rtsp://192.168.31.61:554/stream1',
            thumbnail: '/placeholder-camera.svg',
            location: 'Back Entrance',
            detectionEnabled: true,
            sensitivity: 0.8,
            lastSeen: new Date(),
            resolution: '1920x1080',
            fps: 15
          }
        ];
        setCameras(mockCameras);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch cameras from the backend on initial load
  useEffect(() => {
    logger.info('Initializing camera context', 'CAMERA');
    refreshCameras();

    // Setup motion detection event listener
    const handleMotionDetected = (event: CameraMotionEvent) => {
      logger.info('Motion detected', 'CAMERA', { 
        cameraId: event.cameraId, 
        confidence: event.confidence 
      });
      // Update camera status or trigger notification
      if (event.cameraId) {
        updateCameraLastSeen(event.cameraId);
      }
    };

    // Setup camera status change listener
    const handleCameraStatusChange = (data: { cameraId: string; status: 'online' | 'offline' }) => {
      logger.info('Camera status changed', 'CAMERA', data);
      updateCameraStatus(data.cameraId, data.status);
    };

    // Register socket event listeners
    socketService.on('motionDetected', handleMotionDetected);
    socketService.on('cameraStatus', handleCameraStatusChange);

    // Cleanup on unmount
    return () => {
      socketService.off('motionDetected', handleMotionDetected);
      socketService.off('cameraStatus', handleCameraStatusChange);
    };
  }, [refreshCameras]);

  // Add a new camera
  const addCamera = async (cameraData: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>) => {
    try {
      const cameraId = await apiService.addCamera(cameraData);
      
      // Add to local state
      const newCamera: Camera = {
        id: cameraId,
        ...cameraData,
        status: 'offline', // Start as offline until connection is verified
        lastSeen: new Date(),
        thumbnail: '/placeholder-camera.jpg',
      };
      
      setCameras(prev => [...prev, newCamera]);
      return cameraId;
    } catch (err) {
      console.error('Failed to add camera:', err);
      throw err;
    }
  };

  // Update a camera
  const updateCamera = useCallback(async (id: string, updates: Partial<Camera>) => {
    try {
      // Update in backend
      if (Object.keys(updates).some(key => [
        'name', 'streamUrl', 'fps', 'resolution'
      ].includes(key))) {
        await apiService.updateCamera(id, updates);
      }
      
      // Update in local state
      setCameras(prev => prev.map(camera => 
        camera.id === id ? { ...camera, ...updates } : camera
      ));
    } catch (err) {
      console.error(`Failed to update camera ${id}:`, err);
      throw err;
    }
  }, [apiService, setCameras]);

  // Delete a camera
  const deleteCamera = async (id: string) => {
    try {
      // Delete from backend
      await apiService.deleteCamera(id);
      
      // Remove from local state
      setCameras(prev => prev.filter(camera => camera.id !== id));
    } catch (err) {
      console.error(`Failed to delete camera ${id}:`, err);
      throw err;
    }
  };

  // Get a camera by ID
  const getCameraById = (id: string) => {
    return cameras.find(camera => camera.id === id);
  };

  // Start streaming from a camera
  const startCameraStream = useCallback(async (id: string) => {
    try {
      console.log(`🎬 CameraContext: Requesting stream for camera ${id}`);
      socketService.requestStream(id);
      updateCamera(id, { status: 'online' });
      console.log(`✅ CameraContext: Stream request sent for camera ${id}`);
    } catch (err) {
      console.error(`Failed to start stream for camera ${id}:`, err);
      throw err;
    }
  }, [socketService, updateCamera]);

  // Stop streaming from a camera
  const stopCameraStream = useCallback(async (id: string) => {
    try {
      socketService.stopStream(id);
    } catch (err) {
      console.error(`Failed to stop stream for camera ${id}:`, err);
      throw err;
    }
  }, [socketService]);

  // Take a snapshot from a camera
  const takeSnapshot = async (id: string, resolution?: string) => {
    try {
      return await apiService.takeSnapshot(id, resolution);
    } catch (err) {
      console.error(`Failed to take snapshot for camera ${id}:`, err);
      throw err;
    }
  };

  // Toggle night mode for a camera
  const toggleNightMode = async (id: string, enabled: boolean) => {
    try {
      await apiService.toggleNightMode(id, enabled);
    } catch (err) {
      console.error(`Failed to toggle night mode for camera ${id}:`, err);
      throw err;
    }
  };

  // Toggle motion detection for a camera
  const toggleMotionDetection = async (id: string, enabled: boolean) => {
    try {
      await apiService.updateMotionSettings(id, { enabled });
      updateCamera(id, { detectionEnabled: enabled });
    } catch (err) {
      console.error(`Failed to toggle motion detection for camera ${id}:`, err);
      throw err;
    }
  };

  return (
    <CameraContext.Provider value={{
      cameras,
      loading,
      error,
      addCamera,
      updateCamera,
      deleteCamera,
      getCameraById,
      refreshCameras,
      startCameraStream,
      stopCameraStream,
      takeSnapshot,
      toggleNightMode,
      toggleMotionDetection
    }}>
      {children}
    </CameraContext.Provider>
  );
};
