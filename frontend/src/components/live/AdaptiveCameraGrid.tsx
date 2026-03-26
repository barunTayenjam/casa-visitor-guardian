import React, { useState, useMemo, memo } from 'react';
import { Camera } from '@/types/security';
import { CameraStream } from '@/components/dashboard/CameraStream';
import { X } from 'lucide-react';
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

  return (
    <div className="relative w-full h-full flex flex-col">
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
              return (
                <div className="relative w-full h-full bg-black max-h-screen">
                  {/* Exit Focus Button */}
                  <button
                    className="absolute top-4 right-4 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 transition-all"
                    onClick={() => handleCameraClick(camera.id)}
                    title="Exit fullscreen"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  {/* Camera Stream */}
                  <CameraStream key={`focused-${camera.id}`} camera={camera} autoStart={true} />
                </div>
              );
            })()}
          </div>
        ) : (
          // Grid Mode - Show all cameras
          <div className={getGridClasses()}>
            {activeCameras.map((camera) => (
              <div
                key={camera.id}
                className="relative bg-black overflow-hidden cursor-pointer group aspect-video"
                onClick={() => handleCameraClick(camera.id)}
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
