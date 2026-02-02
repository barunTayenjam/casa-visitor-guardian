import React from 'react';
import { Camera } from '@/types/security';

interface CameraFeedStatusProps {
  camera: Camera;
}

export const CameraFeedStatus: React.FC<CameraFeedStatusProps> = ({ camera }) => {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
      <div
        className={`w-2 h-2 rounded-full ${
          camera.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      />
      <span className="text-xs text-white/90">{camera.name}</span>
    </div>
  );
};
