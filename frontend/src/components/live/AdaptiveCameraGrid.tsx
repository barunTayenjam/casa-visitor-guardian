import React, { useState } from 'react';
import { Camera } from '@/types/security';
import { CameraFeed } from './CameraFeed';
import { Grid3x3, Maximize2 } from 'lucide-react';
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
    if (layout === '1x1') {
      return { columns: 1, rows: 1 };
    }
    if (layout === '2x2') {
      return { columns: 2, rows: 2 };
    }
    if (layout === '3x3') {
      return { columns: 3, rows: 3 };
    }
    
    // Adaptive mode - auto-adjust based on camera count
    if (cameraCount <= 1) return { columns: 1, rows: 1 };
    if (cameraCount <= 4) return { columns: 2, rows: 2 };
    if (cameraCount <= 9) return { columns: 3, rows: 3 };
    return { columns: 4, rows: Math.ceil(cameraCount / 4) };
  };

  const gridConfig = getGridConfig();
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`,
    gridTemplateRows: `repeat(${gridConfig.rows}, 1fr)`,
    gap: '2px',
  };

  const handleLayoutChange = (newLayout: GridLayout) => {
    setLayout(newLayout);
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
            disabled={cameraCount < 2}
          >
            2x2
          </Button>
          <Button
            size="sm"
            variant={layout === '3x3' ? 'default' : 'ghost'}
            onClick={() => handleLayoutChange('3x3')}
            className="h-8 px-3 text-xs font-medium"
            disabled={cameraCount < 4}
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
        ) : (
          <div style={gridStyle} className="w-full h-full">
            {activeCameras.map((camera, index) => (
              <div
                key={camera.id}
                className="relative bg-black overflow-hidden"
                style={{
                  gridColumn: `span ${Math.ceil(gridConfig.columns / Math.ceil(cameraCount / gridConfig.rows)) || 1}`,
                  gridRow: `span ${Math.ceil(gridConfig.rows / Math.ceil(cameraCount / gridConfig.columns)) || 1}`,
                }}
              >
                <CameraFeed
                  camera={camera}
                  isFocused={focusedCameraId === camera.id}
                  onFocus={() => onCameraFocus?.(camera.id)}
                  showControls={layout === '1x1' || focusedCameraId === camera.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
