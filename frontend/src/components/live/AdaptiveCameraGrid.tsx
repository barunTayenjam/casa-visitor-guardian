import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Camera } from '@/types/security';
import { CameraStream } from '@/components/dashboard/CameraStream';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GridLayout = 'adaptive' | '1x1' | '2x2' | '3x3';

interface AdaptiveCameraGridProps {
  cameras: Camera[];
  focusedCameraId?: string;
  onCameraFocus?: (cameraId: string) => void;
}

export const AdaptiveCameraGrid: React.FC<AdaptiveCameraGridProps> = ({
  cameras,
  focusedCameraId,
  onCameraFocus,
}) => {
  const [layout, setLayout] = useState<GridLayout>('adaptive');

  // Memoize active cameras to prevent recalculation
  // Include cameras with online or warning status
  const activeCameras = useMemo(() => 
    cameras.filter(c => c.status === 'online' || c.status === 'warning'), 
    [cameras]
  );
  const cameraCount = activeCameras.length;

  // Determine optimal grid based on camera count and layout preference
  // Responsive: always use 1 column on mobile, adjust on larger screens
  const getGridConfig = () => {
    if (focusedCameraId) {
      return { columns: 1, rows: 1 };
    }

    // Mobile: always 1 column
    // Tablet: 1-2 columns
    // Desktop: 2-3 columns

    if (layout === '1x1') {
      return { columns: 1, rows: Math.max(1, cameraCount) };
    }
    if (layout === '2x2') {
      return { columns: 2, rows: Math.ceil(cameraCount / 2) };
    }
    if (layout === '3x3') {
      return { columns: 3, rows: Math.ceil(cameraCount / 3) };
    }

    // Adaptive mode - auto-adjust based on camera count
    if (cameraCount === 1) return { columns: 1, rows: 1 };
    if (cameraCount === 2) return { columns: 2, rows: 1 };
    if (cameraCount <= 4) return { columns: 2, rows: 2 };
    if (cameraCount <= 6) return { columns: 3, rows: 2 };
    return { columns: 3, rows: Math.ceil(cameraCount / 3) };
  };

  const gridConfig = getGridConfig();

  // Responsive grid classes
  const getGridClasses = () => {
    const base = 'grid gap-1 w-full h-full';

    // Mobile: always 1 column
    // Tablet (md): adjust based on config
    // Desktop (lg): use full config
    if (focusedCameraId) {
      return cn(base, 'grid-cols-1');
    }

    if (gridConfig.columns === 1) {
      return cn(base, 'grid-cols-1');
    }
    if (gridConfig.columns === 2) {
      return cn(base, 'grid-cols-1 md:grid-cols-2');
    }
    if (gridConfig.columns === 3) {
      return cn(base, 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3');
    }

    return base;
  };

  const handleLayoutChange = (newLayout: GridLayout) => {
    console.log('Layout changed to:', newLayout);
    setLayout(newLayout);
    // Clear focus when changing layout
    if (focusedCameraId) {
      onCameraFocus?.(undefined as unknown as string);
    }
  };

  const handleCameraClick = (cameraId: string) => {
    console.log('Camera clicked:', cameraId);
    if (focusedCameraId === cameraId) {
      // Clicking the focused camera unfocuses it
      onCameraFocus?.(undefined as unknown as string);
    } else {
      // Focus the clicked camera
      onCameraFocus?.(cameraId);
    }
  };

  // Swipe gesture tracking
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
      nextIndex = direction === 'next'
        ? (currentIndex + 1) % activeCameras.length
        : (currentIndex - 1 + activeCameras.length) % activeCameras.length;
    }
    onCameraFocus?.(activeCameras[nextIndex].id);
  }, [activeCameras, getFocusedIndex, onCameraFocus]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

    if (absDx > absDy) {
      // Horizontal swipe — switch camera
      navigateCamera(dx > 0 ? 'prev' : 'next');
    } else {
      // Vertical swipe — fullscreen toggle
      if (dy < 0 && !focusedCameraId && activeCameras.length > 0) {
        // Swipe up: enter fullscreen on first camera
        onCameraFocus?.(activeCameras[0].id);
      } else if (dy > 0 && focusedCameraId) {
        // Swipe down: exit fullscreen
        onCameraFocus?.(undefined as unknown as string);
      }
    }
  }, [focusedCameraId, activeCameras, navigateCamera, onCameraFocus]);

  // Keyboard navigation (F for fullscreen, arrow keys for camera switch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (focusedCameraId) {
          onCameraFocus?.(undefined as unknown as string);
        } else if (activeCameras.length > 0) {
          onCameraFocus?.(activeCameras[0].id);
        }
      }
      if (e.key === 'ArrowLeft') navigateCamera('prev');
      if (e.key === 'ArrowRight') navigateCamera('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCameraId, activeCameras, onCameraFocus, navigateCamera]);

  return (
    <div
      className="relative w-full h-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Layout Controls - Minimalist - Hidden on mobile */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 hidden md:flex">
        <div className="flex items-center gap-1 bg-black/60 rounded-lg p-1 border border-white/10">
          <Button
            size="sm"
            variant={layout === 'adaptive' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('adaptive')}
            className="min-h-[44px] min-w-[44px] px-3 text-xs font-medium"
            aria-label="Auto layout"
          >
            Auto
          </Button>
          <Button
            size="sm"
            variant={layout === '1x1' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('1x1')}
            className="min-h-[44px] min-w-[44px] px-3 text-xs font-medium"
            aria-label="1x1 layout"
          >
            1x1
          </Button>
          <Button
            size="sm"
            variant={layout === '2x2' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('2x2')}
            className="min-h-[44px] min-w-[44px] px-3 text-xs font-medium"
            aria-label="2x2 layout"
          >
            2x2
          </Button>
          <Button
            size="sm"
            variant={layout === '3x3' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('3x3')}
            className="min-h-[44px] min-w-[44px] px-3 text-xs font-medium"
            aria-label="3x3 layout"
          >
            3x3
          </Button>
        </div>
      </div>

      {/* Camera Grid */}
      <div className="flex-1 bg-black">
        {activeCameras.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            <div className="text-center">
              <p className="text-lg">No Cameras Online</p>
              <p className="text-sm mt-2">Add cameras to start viewing live streams</p>
            </div>
          </div>
        ) : focusedCameraId ? (
          // Focused Mode - Show one camera full screen
          <div className="w-full h-full flex items-center justify-center">
            {(() => {
              const camera = activeCameras.find(c => c.id === focusedCameraId);
              if (!camera) return null;
              const camIndex = getFocusedIndex();
              return (
                <div className="relative w-full h-full bg-black max-h-screen">
                  {/* Exit Focus Button */}
                  <button
                    className="absolute top-4 right-4 z-10 min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 transition-all"
                    onClick={() => handleCameraClick(camera.id)}
                    title="Exit fullscreen"
                    aria-label="Exit fullscreen"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  {/* Swipe Navigation Arrows (mobile) */}
                  {activeCameras.length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 md:hidden min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all"
                        onClick={() => navigateCamera('prev')}
                        title="Previous camera"
                        aria-label="Previous camera"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 md:hidden min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all"
                        onClick={() => navigateCamera('next')}
                        title="Next camera"
                        aria-label="Next camera"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}

                  {/* Camera Stream */}
                  <CameraStream key={`focused-${camera.id}`} camera={camera} autoStart={true} />

                  {/* Camera Position Indicator */}
                  {activeCameras.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
                      {activeCameras.map((cam, i) => (
                        <button
                          key={cam.id}
                          className={cn(
                            "rounded-full transition-all",
                            cam.id === focusedCameraId
                              ? "w-2.5 h-2.5 bg-white"
                              : "w-2 h-2 bg-white/40 hover:bg-white/60"
                          )}
                          onClick={() => onCameraFocus?.(cam.id)}
                          aria-label={`Switch to ${cam.name}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          // Grid Mode - Show all cameras
          <div className={getGridClasses()} role="group" aria-label="Camera grid">
            {activeCameras.map((camera) => (
              <div
                key={camera.id}
                className="relative bg-black overflow-hidden cursor-pointer group aspect-video"
                onClick={() => handleCameraClick(camera.id)}
                role="button"
                tabIndex={0}
                aria-label={`${camera.name} camera feed`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCameraClick(camera.id);
                  }
                }}
              >
                {/* Camera Stream */}
                <CameraStream key={`grid-${camera.id}`} camera={camera} autoStart={true} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
