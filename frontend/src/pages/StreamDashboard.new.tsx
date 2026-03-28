import React, { useState, useCallback } from 'react';
import { useCameras } from '@/contexts/CameraContext';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';

/**
 * Minimal streaming page focused on live camera views.
 * All non-essential UI removed to prioritize the stream experience.
 */
const StreamDashboard = () => {
  const { cameras } = useCameras();
  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>(undefined);

  const handleCameraFocus = useCallback((cameraId: string) => {
    if (cameraId === 'undefined' || cameraId === undefined || cameraId === '') {
      setFocusedCameraId(undefined);
    } else if (focusedCameraId === cameraId) {
      setFocusedCameraId(undefined);
    } else {
      setFocusedCameraId(cameraId);
    }
  }, []);

  // Include cameras with online or warning status
  const activeCameras = cameras.filter(c => c.status === 'online' || c.status === 'warning');

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col bg-background">
      {/* Main Content - Full Viewport Camera Grid */}
      <div className="flex-1 relative overflow-hidden">
        <AdaptiveCameraGrid
          cameras={cameras}
          focusedCameraId={focusedCameraId}
          onCameraFocus={handleCameraFocus}
        />
      </div>
    </div>
  );
};

export default StreamDashboard;
