import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useCameras } from '@/contexts/CameraContext';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';

const StreamDashboard = () => {
  const { cameras } = useCameras();
  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCameraFocus = useCallback((cameraId: string | undefined) => {
    setFocusedCameraId(prev => {
      if (!cameraId) return undefined;
      else if (prev === cameraId) return undefined;
      else return cameraId;
    });
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {!focusedCameraId && (
        <div className="px-5 pt-6 pb-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
            Live View
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Cameras</h1>
        </div>
      )}
      <div
        ref={containerRef}
        className={`flex-1 ${focusedCameraId ? '' : 'px-4 pb-28'}`}
      >
        <div className={focusedCameraId ? 'h-full' : 'rounded-[4px] overflow-hidden'}>
          <AdaptiveCameraGrid
            cameras={cameras}
            focusedCameraId={focusedCameraId}
            onCameraFocus={handleCameraFocus}
          />
        </div>
      </div>
    </div>
  );
};

export default StreamDashboard;
