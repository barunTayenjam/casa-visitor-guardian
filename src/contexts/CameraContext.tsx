
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Camera } from '@/types/security';

interface CameraContextType {
  cameras: Camera[];
  addCamera: (camera: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>) => void;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
  deleteCamera: (id: string) => void;
  getCameraById: (id: string) => Camera | undefined;
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
  const [cameras, setCameras] = useState<Camera[]>([
    {
      id: 'cam1',
      name: 'Front Door',
      status: 'online',
      streamUrl: 'rtsp://username:password@192.168.1.100:554/stream1',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Main Entrance',
      detectionEnabled: true,
      sensitivity: 0.75,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 30
    },
    {
      id: 'cam2',
      name: 'Backyard',
      status: 'online',
      streamUrl: 'rtsp://username:password@192.168.1.101:554/stream1',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Garden Area',
      detectionEnabled: true,
      sensitivity: 0.60,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 30
    },
    {
      id: 'cam3',
      name: 'Garage',
      status: 'offline',
      streamUrl: 'rtsp://username:password@192.168.1.102:554/stream1',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Garage Entrance',
      detectionEnabled: false,
      sensitivity: 0.65,
      lastSeen: new Date(Date.now() - 15 * 60 * 1000),
      resolution: '1280x720',
      fps: 15
    }
  ]);

  const addCamera = (cameraData: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>) => {
    const newCamera: Camera = {
      id: `cam${Date.now()}`,
      ...cameraData,
      status: 'offline', // Start as offline until connection is verified
      lastSeen: new Date(),
      thumbnail: '/placeholder-camera.jpg',
    };
    setCameras(prev => [...prev, newCamera]);
  };

  const updateCamera = (id: string, updates: Partial<Camera>) => {
    setCameras(prev => prev.map(camera => 
      camera.id === id ? { ...camera, ...updates } : camera
    ));
  };

  const deleteCamera = (id: string) => {
    setCameras(prev => prev.filter(camera => camera.id !== id));
  };

  const getCameraById = (id: string) => {
    return cameras.find(camera => camera.id === id);
  };

  return (
    <CameraContext.Provider value={{
      cameras,
      addCamera,
      updateCamera,
      deleteCamera,
      getCameraById
    }}>
      {children}
    </CameraContext.Provider>
  );
};
