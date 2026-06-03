import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useCameras } from '@/contexts/CameraContext';
import { AdaptiveCameraGrid } from '@/components/live/AdaptiveCameraGrid';
import { MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const StreamDashboard = () => {
  const { cameras } = useCameras();
  const [focusedCameraId, setFocusedCameraId] = useState<string | undefined>(undefined);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCameraFocus = useCallback((cameraId: string | undefined) => {
    setFocusedCameraId(prev => {
      if (!cameraId) return undefined;
      else if (prev === cameraId) return undefined;
      else return cameraId;
    });
  }, []);

  const handleStartSlideshow = useCallback(() => {
    if (cameras.length > 0) {
      handleCameraFocus(cameras[0].id);
      setSlideshowActive(true);
      document.documentElement.requestFullscreen();
    }
  }, [cameras, handleCameraFocus]);

  return (
    <div className={cn("flex flex-col", focusedCameraId ? "absolute inset-0" : "h-full")}>
      {!focusedCameraId && (
        <div className="px-5 pt-6 pb-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
            Live View
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Cameras</h1>
            {cameras.length > 1 && (
              <Button onClick={handleStartSlideshow} variant="outline" size="sm" className="h-9 gap-2 rounded-full">
                <MonitorPlay className="h-4 w-4" />
                <span className="hidden sm:inline">Slideshow</span>
              </Button>
            )}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn("flex-1 min-h-0", focusedCameraId ? "" : "px-4 pb-28")}
      >
        <div className={focusedCameraId ? 'h-full' : 'rounded-[4px] overflow-hidden'}>
          <AdaptiveCameraGrid
            cameras={cameras}
            focusedCameraId={focusedCameraId}
            onCameraFocus={handleCameraFocus}
            slideshowActive={slideshowActive}
            onSlideshowChange={setSlideshowActive}
          />
        </div>
      </div>
    </div>
  );
};

export default StreamDashboard;
