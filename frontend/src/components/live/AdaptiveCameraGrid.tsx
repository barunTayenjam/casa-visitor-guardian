import React, { useState } from 'react';
import { Camera } from '@/types/security';
import { CameraStream } from '@/components/dashboard/CameraStream';
import { Grid3x3, Maximize2, X } from 'lucide-react';
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

  const activeCameras = cameras.filter(c => c.status === 'online');
  const cameraCount = activeCameras.length;

  // Determine optimal grid based on camera count and layout preference
  const getGridConfig = () => {
    if (focusedCameraId) {
      return { columns: 1, rows: 1 };
    }
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
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`,
    gridTemplateRows: `repeat(${gridConfig.rows}, 1fr)`,
    gap: '2px',
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
      {/* Layout Controls - Minimalist */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1 border border-white/10">
          <Button
            size="sm"
            variant={layout === 'adaptive' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('adaptive')}
            className="h-8 px-3 text-xs font-medium"
          >
            Auto
          </Button>
          <Button
            size="sm"
            variant={layout === '1x1' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('1x1')}
            className="h-8 px-3 text-xs font-medium"
          >
            1x1
          </Button>
          <Button
            size="sm"
            variant={layout === '2x2' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('2x2')}
            className="h-8 px-3 text-xs font-medium"
          >
            2x2
          </Button>
          <Button
            size="sm"
            variant={layout === '3x3' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('3x3')}
            className="h-8 px-3 text-xs font-medium"
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
                    className="absolute top-4 right-4 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white hover:bg-white/10 transition-all"
                    onClick={() => handleCameraClick(camera.id)}
                    title="Exit fullscreen"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  {/* Camera Stream */}
                  <CameraStream camera={camera} autoStart={true} />

                  {/* Status Overlay - Top Left */}
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-black/60 border border-white/10">
                      <div className={cn('w-2 h-2 rounded-full animate-pulse', camera.status === 'online' ? 'bg-green-500' : 'bg-red-500')} />
                      <span className="text-xs font-medium text-white/90">{camera.name}</span>
                      {camera.status === 'online' && <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">LIVE</span>}
                    </div>
                  </div>

                  {/* Timestamp Overlay - Bottom Left */}
                  <div className="absolute bottom-4 left-4 z-10 px-2 py-1 rounded backdrop-blur-sm bg-black/60 border border-white/10 pointer-events-none">
                    <span className="text-xs font-mono text-white/80">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          // Grid Mode - Show all cameras
          <div style={gridStyle} className="w-full h-full">
            {activeCameras.map((camera) => (
              <div
                key={camera.id}
                className="relative bg-black overflow-hidden cursor-pointer group aspect-video"
                onClick={() => handleCameraClick(camera.id)}
              >
                {/* Camera Stream */}
                <CameraStream camera={camera} autoStart={true} />

                {/* Status Overlay - Top Left */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-black/60 border border-white/10">
                    <div className={cn('w-2 h-2 rounded-full animate-pulse', camera.status === 'online' ? 'bg-green-500' : 'bg-red-500')} />
                    <span className="text-xs font-medium text-white/90">{camera.name}</span>
                    {camera.status === 'online' && <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">LIVE</span>}
                  </div>
                </div>

                {/* Timestamp Overlay - Bottom Left */}
                <div className="absolute bottom-3 left-3 z-10 px-2 py-1 rounded backdrop-blur-sm bg-black/60 border border-white/10 pointer-events-none">
                  <span className="text-xs font-mono text-white/80">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>

                {/* Expand Button - Bottom Right */}
                <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded bg-black/60 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCameraClick(camera.id);
                    }}
                    title="Expand to fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
