import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Camera } from '@/types/security';
import { CameraStream } from '@/components/dashboard/CameraStream';
import { X, ChevronLeft, ChevronRight, MonitorPlay, MonitorStop } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useViewportStream, StreamSlotManager } from '@/hooks/useViewportStream';

export type GridLayout = 'adaptive' | '1x1' | '2x2' | '3x3';

const SLOT_MANAGER_MAX = 4;

const ViewportCameraCard: React.FC<{ camera: Camera; slotManager: StreamSlotManager; onClick: () => void; onKeyDown: (e: React.KeyboardEvent) => void; gridKey: string; className?: string; absolute?: boolean }> = ({ camera, slotManager, onClick, onKeyDown, gridKey, className, absolute }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { isVisible } = useViewportStream(cardRef);
  const [slotAcquired, setSlotAcquired] = useState(false);
  const acquiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!isVisible) {
      if (acquiredRef.current) {
        slotManager.release(camera.id);
        acquiredRef.current = false;
        setSlotAcquired(false);
      }
      return;
    }
    (async () => {
      await slotManager.acquire(camera.id);
      if (!cancelled) {
        acquiredRef.current = true;
        setSlotAcquired(true);
      }
    })();
    return () => {
      cancelled = true;
      if (acquiredRef.current) {
        slotManager.release(camera.id);
        acquiredRef.current = false;
      }
    };
  }, [camera.id, slotManager, isVisible]);

  const shouldStream = isVisible && slotAcquired;

  return (
    <div ref={cardRef} className={cn(
      "overflow-hidden cursor-pointer group h-full min-h-0 rounded-[0.75rem]",
      !absolute && "relative",
      className
    )}
      onClick={onClick}
      role="button" tabIndex={0} aria-label={`${camera.name} camera feed`}
      onKeyDown={onKeyDown}
    >
      <CameraStream key={gridKey} camera={camera} autoStart={shouldStream} />
    </div>
  );
};

interface AdaptiveCameraGridProps {
  cameras: Camera[];
  focusedCameraId?: string;
  onCameraFocus?: (cameraId: string | undefined) => void;
  slideshowActive?: boolean;
  onSlideshowChange?: (active: boolean) => void;
}

export const AdaptiveCameraGrid: React.FC<AdaptiveCameraGridProps> = ({ cameras, focusedCameraId, onCameraFocus, slideshowActive = false, onSlideshowChange }) => {
  const [layout, setLayout] = useState<GridLayout>('adaptive');
  const [fadeOverlay, setFadeOverlay] = useState(false);
  const [slideshowInterval, setSlideshowInterval] = useState(5);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotManagerRef = useRef(new StreamSlotManager(SLOT_MANAGER_MAX));
  const focusedContainerRef = useRef<HTMLDivElement>(null);
  const slideshowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigateCameraRef = useRef<(direction: 'prev' | 'next') => void>(() => {});

  useEffect(() => { return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); }; }, []);

  useEffect(() => {
    const slotManager = slotManagerRef.current;
    return () => {
      slotManager.releaseAll();
      if (slideshowTimerRef.current) clearInterval(slideshowTimerRef.current);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        onSlideshowChange?.(false);
        onCameraFocus?.(undefined);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [onSlideshowChange, onCameraFocus]);

  useEffect(() => {
    if (slideshowActive) {
      slideshowTimerRef.current = setInterval(() => {
        navigateCameraRef.current('next');
      }, slideshowInterval * 1000);
    } else {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
    }
    return () => {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
    };
  }, [slideshowActive, slideshowInterval]);

  const activeCameras = useMemo(() => cameras, [cameras]);
  const cameraCount = activeCameras.length;

  const getGridConfig = () => {
    if (focusedCameraId) return { columns: 1, rows: 1 };
    if (layout === '1x1') return { columns: 1, rows: Math.max(1, cameraCount) };
    if (layout === '2x2') return { columns: 2, rows: Math.ceil(cameraCount / 2) };
    if (layout === '3x3') return { columns: 3, rows: Math.ceil(cameraCount / 3) };
    if (cameraCount === 1) return { columns: 1, rows: 1 };
    if (cameraCount === 2) return { columns: 2, rows: 1 };
    if (cameraCount <= 4) return { columns: 2, rows: 2 };
    if (cameraCount <= 6) return { columns: 3, rows: 2 };
    return { columns: 3, rows: Math.ceil(cameraCount / 3) };
  };

  const gridConfig = getGridConfig();

  const getGridClasses = () => {
    const base = 'grid gap-2 w-full h-full auto-rows-fr';
    if (focusedCameraId) return cn(base, 'grid-cols-1 grid-rows-1');
    if (gridConfig.columns === 1) return cn(base, 'grid-cols-1');
    if (gridConfig.columns === 2) return cn(base, 'grid-cols-1 md:grid-cols-2');
    if (gridConfig.columns === 3) return cn(base, 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3');
    return base;
  };

  const handleLayoutChange = (newLayout: GridLayout) => {
    setLayout(newLayout);
    if (focusedCameraId) onCameraFocus?.(undefined);
  };

  const handleCameraClick = (cameraId: string) => {
    onCameraFocus?.(focusedCameraId === cameraId ? undefined : cameraId);
  };

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD = 50;

  const getFocusedIndex = useCallback(() => {
    if (!focusedCameraId) return -1;
    return activeCameras.findIndex(c => c.id === focusedCameraId);
  }, [focusedCameraId, activeCameras]);

  const navigateCamera = useCallback((direction: 'prev' | 'next') => {
    if (activeCameras.length < 2) return;
    const currentIndex = getFocusedIndex();
    let nextIndex: number;
    if (currentIndex === -1) {
      nextIndex = direction === 'next' ? 0 : activeCameras.length - 1;
    } else {
      nextIndex = direction === 'next' ? (currentIndex + 1) % activeCameras.length : (currentIndex - 1 + activeCameras.length) % activeCameras.length;
    }
    const targetId = activeCameras[nextIndex].id;
    if (focusedCameraId && currentIndex !== -1) {
      setFadeOverlay(true);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setFadeOverlay(false), 300);
    }
    onCameraFocus?.(targetId);
  }, [activeCameras, getFocusedIndex, focusedCameraId, onCameraFocus]);

  useEffect(() => { navigateCameraRef.current = navigateCamera; }, [navigateCamera]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]; touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      navigateCamera(dx > 0 ? 'prev' : 'next');
    } else {
      if (dy < 0 && !focusedCameraId && activeCameras.length > 0) onCameraFocus?.(activeCameras[0].id);
      else if (dy > 0 && focusedCameraId) onCameraFocus?.(undefined);
    }
  }, [focusedCameraId, activeCameras, navigateCamera, onCameraFocus]);

  const mouseDragRef = useRef<{ startX: number; startY: number } | null>(null);
  const mouseDraggingRef = useRef(false);
  const mouseCleanupRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null);

  useEffect(() => {
    return () => { if (mouseCleanupRef.current) { document.removeEventListener('mousemove', mouseCleanupRef.current.move); document.removeEventListener('mouseup', mouseCleanupRef.current.up); mouseCleanupRef.current = null; } };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    mouseDragRef.current = { startX: e.clientX, startY: e.clientY };
    mouseDraggingRef.current = false;
    const handleMouseMove = (moveE: MouseEvent) => {
      if (!mouseDragRef.current) return;
      if (Math.abs(moveE.clientX - mouseDragRef.current.startX) > SWIPE_THRESHOLD / 2 || Math.abs(moveE.clientY - mouseDragRef.current.startY) > SWIPE_THRESHOLD / 2) mouseDraggingRef.current = true;
    };
    const handleMouseUp = (upE: MouseEvent) => {
      if (mouseDragRef.current) {
        const dx = upE.clientX - mouseDragRef.current.startX;
        const dy = upE.clientY - mouseDragRef.current.startY;
        mouseDragRef.current = null;
        if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) { navigateCamera(dx > 0 ? 'prev' : 'next'); }
        else if (Math.abs(dy) >= SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) { if (dy < 0 && !focusedCameraId && activeCameras.length > 0) onCameraFocus?.(activeCameras[0].id); else if (dy > 0 && focusedCameraId) onCameraFocus?.(undefined); }
      }
      mouseDraggingRef.current = false; mouseCleanupRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    mouseCleanupRef.current = { move: handleMouseMove, up: handleMouseUp };
  }, [navigateCamera, focusedCameraId, activeCameras, onCameraFocus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') { if (focusedCameraId) onCameraFocus?.(undefined); else if (activeCameras.length > 0) onCameraFocus?.(activeCameras[0].id); }
      if (e.key === 'ArrowLeft') navigateCamera('prev');
      if (e.key === 'ArrowRight') navigateCamera('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCameraId, activeCameras, onCameraFocus, navigateCamera]);

  const handleStartSlideshow = useCallback(() => {
    onSlideshowChange?.(true);
    document.documentElement.requestFullscreen();
  }, [onSlideshowChange]);

  const handleStopSlideshow = useCallback(() => {
    onSlideshowChange?.(false);
    onCameraFocus?.(undefined);
    if (slideshowTimerRef.current) {
      clearInterval(slideshowTimerRef.current);
      slideshowTimerRef.current = null;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [onSlideshowChange, onCameraFocus]);

  return (
    <div ref={focusedContainerRef} className="relative w-full h-full flex flex-col min-h-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex-1 min-h-0">
        {activeCameras.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-white/60">
            <div className="text-center"><p className="text-base">No Cameras Online</p><p className="text-sm mt-2">Add cameras to start viewing live streams</p></div>
          </div>
        ) : (
          <div className={cn(focusedCameraId ? "w-full h-full bg-black grid grid-cols-1 grid-rows-1 overflow-hidden auto-rows-[0]" : getGridClasses())} role="group" aria-label="Camera grid">
            {activeCameras.map((camera) => (
              <ViewportCameraCard
                key={camera.id}
                camera={camera}
                slotManager={slotManagerRef.current}
                gridKey={`grid-${camera.id}`}
                absolute={!!focusedCameraId}
                className={cn(
                  focusedCameraId && "absolute inset-0",
                  focusedCameraId && camera.id !== focusedCameraId && "opacity-0 pointer-events-none",
                  focusedCameraId && camera.id === focusedCameraId && "rounded-none"
                )}
                onClick={() => handleCameraClick(camera.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCameraClick(camera.id); } }}
              />
            ))}
          </div>
        )}
        {focusedCameraId && (
          <div className="absolute inset-0 z-20 pointer-events-none" onMouseDown={handleMouseDown}>
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                {!slideshowActive ? (
                  <button
                    className="min-h-[44px] min-w-[44px] h-11 px-3 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] text-xs font-medium"
                    onClick={(e) => { e.stopPropagation(); handleStartSlideshow(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Start slideshow" aria-label="Start slideshow"
                  >
                    <MonitorPlay className="h-4 w-4" />
                    <span className="hidden sm:inline">Slideshow</span>
                  </button>
                ) : (
                  <>
                    <button
                      className="min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-red-500/80 backdrop-blur-md border border-red-500/30 text-white hover:bg-red-500 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                      onClick={(e) => { e.stopPropagation(); handleStopSlideshow(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Stop slideshow" aria-label="Stop slideshow"
                    >
                      <MonitorStop className="h-4 w-4" />
                    </button>
                    <div className="flex gap-1">
                      {[3, 5, 10].map((sec) => (
                        <button key={sec}
                          className={cn(
                            "px-2.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border transition-all",
                            slideshowInterval === sec
                              ? "bg-white/20 border-white/20 text-white"
                              : "bg-black/40 border-white/10 text-white/60 hover:text-white hover:bg-black/60"
                          )}
                          onClick={(e) => { e.stopPropagation(); setSlideshowInterval(sec); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title={`${sec} seconds`} aria-label={`${sec} seconds`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                className="pointer-events-auto min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                onClick={(e) => { e.stopPropagation(); handleCameraClick(focusedCameraId!); }}
                onMouseDown={(e) => e.stopPropagation()}
                title="Exit fullscreen" aria-label="Exit fullscreen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {activeCameras.length > 1 && (
              <>
                <button className="absolute left-2 top-1/2 -translate-y-1/2 md:hidden min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  onClick={(e) => { e.stopPropagation(); navigateCamera('prev'); }} onMouseDown={(e) => e.stopPropagation()} title="Previous camera" aria-label="Previous camera"
                ><ChevronLeft className="h-6 w-6" /></button>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 md:hidden min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  onClick={(e) => { e.stopPropagation(); navigateCamera('next'); }} onMouseDown={(e) => e.stopPropagation()} title="Next camera" aria-label="Next camera"
                ><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
            {activeCameras.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {activeCameras.map((cam) => (
                  <button key={cam.id}
                    className={cn("rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]", cam.id === focusedCameraId ? "w-2.5 h-2.5 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60")}
                    onClick={(e) => { e.stopPropagation(); onCameraFocus?.(cam.id); }}
                    onMouseDown={(e) => e.stopPropagation()} aria-label={`Switch to ${cam.name}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
