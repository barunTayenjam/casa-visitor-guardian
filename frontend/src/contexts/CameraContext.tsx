import React from 'react';
import { useCameraStore } from '@/stores/camera';
import { Camera } from '@/types/security';

export interface CameraContextType {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  addCamera: (camera: Omit<Camera, 'id' | 'status' | 'lastSeen' | 'thumbnail'>) => Promise<string>;
  updateCamera: (id: string, updates: Partial<Camera>) => Promise<void>;
  deleteCamera: (id: string) => Promise<void>;
  getCameraById: (id: string) => Camera | undefined;
  refreshCameras: () => Promise<void>;
  startCameraStream: (id: string) => Promise<void>;
  stopCameraStream: (id: string) => void;
  takeSnapshot: (id: string, resolution?: string) => Promise<string>;
  toggleNightMode: (id: string, enabled: boolean) => Promise<void>;
  toggleMotionDetection: (id: string, enabled: boolean) => Promise<void>;
}

export const useCameras = () => {
  const store = useCameraStore();
  return {
    cameras: store.cameras,
    loading: store.loading,
    error: store.error,
    addCamera: store.addCamera,
    updateCamera: store.updateCamera,
    deleteCamera: store.deleteCamera,
    getCameraById: store.getCameraById,
    refreshCameras: store.fetchCameras,
    startCameraStream: store.startCameraStream,
    stopCameraStream: store.stopCameraStream,
    takeSnapshot: async () => '',
    toggleNightMode: async () => {},
    toggleMotionDetection: async () => {},
  };
};

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
