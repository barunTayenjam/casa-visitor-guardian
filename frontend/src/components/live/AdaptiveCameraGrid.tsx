import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Camera } from '@/types/security';
import { CameraStream } from '@/components/dashboard/CameraStream';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useViewportStream, StreamSlotManager } from '@/hooks/useViewportStream';

export type GridLayout = 'adaptive' | '1x1' | '2x2' | '3x3';

const SLOT_MANAGER_MAX = 4;

const ViewportCameraCard: React.FC<{ camera: Camera; slotManager: StreamSlotManager; onClick: () => void; onKeyDown: (e: React.KeyboardEvent) => void; gridKey: string }> = ({ camera, slotManager, onClick, onKeyDown, gridKey }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { isVisible } = useViewportStream(cardRef);
  const [slotAcquired, setSlotAcquired] = useState(false);
  const acquiredRef = useRef(false);

  console.log('[STREAM] ViewportCameraCard render:', camera.id, 'isVisible:', isVisible, 'slotAcquired:', slotAcquired);

  useEffect(() => {
    console.log('[STREAM] ViewportCameraCard visibility effect:', camera.id, 'isVisible:', isVisible);
    let cancelled = false;
    if (!isVisible) {
      if (acquiredRef.current) {
        console.log('[STREAM] Releasing slot for:', camera.id);
        slotManager.release(camera.id);
        acquiredRef.current = false;
        setSlotAcquired(false);
      }
      return;
    }
    (async () => {
      console.log('[STREAM] Acquiring slot for:', camera.id);
      await slotManager.acquire(camera.id);
      if (!cancelled) {
        console.log('[STREAM] Slot acquired for:', camera.id);
        acquiredRef.current = true;
        setSlotAcquired(true);
      } else {
        console.log('[STREAM] Slot acquisition cancelled for:', camera.id);
      }
    })();
    return () => {
      cancelled = true;
      if (acquiredRef.current) {
        console.log('[STREAM] Cleanup releasing slot for:', camera.id);
        slotManager.release(camera.id);
        acquiredRef.current = false;
      }
    };
  }, [camera.id, slotManager, isVisible]);

  const shouldStream = isVisible && slotAcquired;
  console.log('[STREAM] ViewportCameraCard shouldStream:', camera.id, '=', shouldStream, '(visible:', isVisible, 'slot:', slotAcquired, ')');

  return (
    <div ref={cardRef} className="relative overflow-hidden cursor-pointer group h-full min-h-0 rounded-[0.75rem]"
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
}

export const AdaptiveCameraGrid: React.FC<AdaptiveCameraGridProps> = ({ cameras, focusedCameraId, onCameraFocus }) => {
  const [layout, setLayout] = useState<GridLayout>('adaptive');
  const [transitionOffset, setTransitionOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [switchCameraId, setSwitchCameraId] = useState<string | undefined>(focusedCameraId);
  const isTransitioningRef = useRef(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotManagerRef = useRef(new StreamSlotManager(SLOT_MANAGER_MAX));

  useEffect(() => { if (!isAnimating) setSwitchCameraId(focusedCameraId); }, [focusedCameraId, isAnimating]);

  useEffect(() => { return () => { if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current); }; }, []);

  useEffect(() => { return () => { slotManagerRef.current.releaseAll(); }; }, []);

  const switchCameraWithAnimation = useCallback((direction: 'left' | 'right', targetCameraId: string) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setTransitionOffset(direction === 'left' ? 60 : -60);
    setIsAnimating(true);
    requestAnimationFrame(() => {
      setSwitchCameraId(targetCameraId);
      requestAnimationFrame(() => setTransitionOffset(0));
    });
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => { setIsAnimating(false); isTransitioningRef.current = false; }, 300);
  }, []);

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
    const base = 'grid gap-2 w-full h-full';
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
    if (focusedCameraId && currentIndex !== -1) switchCameraWithAnimation(direction === 'next' ? 'left' : 'right', targetId);
    onCameraFocus?.(targetId);
  }, [activeCameras, getFocusedIndex, focusedCameraId, onCameraFocus, switchCameraWithAnimation]);

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

  return (
    <div className="relative w-full h-full flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex-1">
        {activeCameras.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-white/60">
            <div className="text-center"><p className="text-base">No Cameras Online</p><p className="text-sm mt-2">Add cameras to start viewing live streams</p></div>
          </div>
        ) : focusedCameraId ? (
          <div className="w-full h-full flex items-center justify-center">
            {(() => {
              const camera = activeCameras.find(c => c.id === switchCameraId);
              if (!camera) return null;
              return (
                <div className={cn("relative w-full h-full max-h-screen select-none", isAnimating && "transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]")}
                  style={{ transform: `translateX(${transitionOffset}px)` }}
                  onMouseDown={handleMouseDown}
                  onTransitionEnd={(e) => { if (e.propertyName === 'transform' && isTransitioningRef.current) { setIsAnimating(false); isTransitioningRef.current = false; } }}
                >
                  <button
                    className="absolute top-4 right-4 z-10 min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                    onClick={(e) => { e.stopPropagation(); handleCameraClick(camera.id); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Exit fullscreen" aria-label="Exit fullscreen"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  {activeCameras.length > 1 && (
                    <>
                      <button className="absolute left-2 top-1/2 -translate-y-1/2 z-10 md:hidden min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                        onClick={(e) => { e.stopPropagation(); navigateCamera('prev'); }} onMouseDown={(e) => e.stopPropagation()} title="Previous camera" aria-label="Previous camera"
                      ><ChevronLeft className="h-6 w-6" /></button>
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 z-10 md:hidden min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                        onClick={(e) => { e.stopPropagation(); navigateCamera('next'); }} onMouseDown={(e) => e.stopPropagation()} title="Next camera" aria-label="Next camera"
                      ><ChevronRight className="h-6 w-6" /></button>
                    </>
                  )}
                  <CameraStream key={`focused-${camera.id}`} camera={camera} autoStart={true} />
                  {activeCameras.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
                      {activeCameras.map((cam) => (
                        <button key={cam.id}
                          className={cn("rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]", cam.id === focusedCameraId ? "w-2.5 h-2.5 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60")}
                          onClick={(e) => { e.stopPropagation(); const ci = activeCameras.findIndex(c => c.id === focusedCameraId); const ti = activeCameras.findIndex(c => c.id === cam.id); if (ci !== -1 && ti !== -1 && ci !== ti) switchCameraWithAnimation(ti > ci ? 'left' : 'right', cam.id); onCameraFocus?.(cam.id); }}
                          onMouseDown={(e) => e.stopPropagation()} aria-label={`Switch to ${cam.name}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className={getGridClasses()} role="group" aria-label="Camera grid">
            {activeCameras.map((camera) => (
              <ViewportCameraCard key={camera.id}
                camera={camera}
                slotManager={slotManagerRef.current}
                gridKey={`grid-${camera.id}`}
                onClick={() => handleCameraClick(camera.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCameraClick(camera.id); } }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
