import { useState, useRef, useEffect } from 'react';
import { Camera as CameraIcon, Play, Pause, Maximize2, Settings, MoreVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCameras } from '@/contexts/CameraContext';
import { CameraStream } from './CameraStream';
import { Camera } from '@/types/security';

interface TabletCameraGridProps {
  onCameraSelect?: (camera: Camera) => void;
}

export const TabletCameraGrid = ({ onCameraSelect }: TabletCameraGridProps) => {
  const { cameras, loading, error } = useCameras();
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [longPressCamera, setLongPressCamera] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout>();
  
  const currentCamera = cameras.find(c => c.id === selectedCamera);

  // Handle long press for context menu
  const handleTouchStart = (cameraId: string) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressCamera(cameraId);
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleCameraClick = (camera: Camera) => {
    if (longPressCamera) {
      setLongPressCamera(null);
      return;
    }
    setSelectedCamera(camera.id);
    onCameraSelect?.(camera);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-12 text-center max-w-md">
          <CameraIcon className="h-16 w-16 text-muted-foreground animate-pulse mx-auto mb-6" />
          <h3 className="text-2xl font-medium mb-4">Loading Cameras...</h3>
          <p className="text-lg text-muted-foreground">
            Please wait while we load your camera configuration.
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-12 text-center max-w-md">
          <CameraIcon className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-2xl font-medium text-red-600 mb-4">Error Loading Cameras</h3>
          <p className="text-lg text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-12 text-center max-w-md">
          <CameraIcon className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-2xl font-medium mb-4">No Cameras Configured</h3>
          <p className="text-lg text-muted-foreground mb-6">
            No cameras are currently configured in the system.
          </p>
          <Button size="lg" className="h-12 px-8">
            <Settings className="h-5 w-5 mr-2" />
            Add Camera
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 p-6">
        {/* Camera Grid */}
        <div 
          className="grid gap-6 h-full"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gridAutoRows: 'minmax(280px, 1fr)',
          }}
        >
          {cameras.map((camera) => (
            <Card
              key={camera.id}
              className="relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
              onClick={() => handleCameraClick(camera)}
              onTouchStart={() => handleTouchStart(camera.id)}
              onTouchEnd={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {/* Camera Stream */}
              <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
                <CameraStream camera={camera} />
                
                {/* Camera Info Overlay */}
                <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
                  <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
                    <h3 className="text-lg font-semibold">{camera.name}</h3>
                    <p className="text-sm opacity-90">{camera.location}</p>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${
                      camera.status === 'online' ? 'bg-green-500' : 
                      camera.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <Badge 
                      variant={camera.status === 'online' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {camera.status}
                    </Badge>
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" className="h-10 w-10 p-0">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="secondary" className="h-10 w-10 p-0">
                      <Pause className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" className="h-10 w-10 p-0">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    
                    {/* Context Menu */}
                    <DropdownMenu 
                      open={longPressCamera === camera.id} 
                      onOpenChange={(open) => !open && setLongPressCamera(null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary" className="h-10 w-10 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem>
                          <CameraIcon className="h-4 w-4 mr-2" />
                          Take Snapshot
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Settings className="h-4 w-4 mr-2" />
                          Camera Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Maximize2 className="h-4 w-4 mr-2" />
                          Full Screen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Recording Indicator */}
                {camera.status === 'online' && (
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-2 bg-red-500/90 text-white px-3 py-1 rounded-full text-sm">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      REC
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Full Screen Dialog */}
      <Dialog open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 border-0">
          {currentCamera && (
            <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
              <CameraStream camera={currentCamera} fullscreen />
              
              {/* Full Screen Overlay */}
              <div className="absolute top-6 left-6 bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-lg">
                <h2 className="text-2xl font-bold">{currentCamera.name}</h2>
                <p className="text-lg opacity-90">{currentCamera.location}</p>
              </div>

              {/* Full Screen Controls */}
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button size="lg" variant="secondary" className="h-14 px-6">
                    <Play className="h-6 w-6 mr-2" />
                    Play
                  </Button>
                  <Button size="lg" variant="secondary" className="h-14 px-6">
                    <Pause className="h-6 w-6 mr-2" />
                    Pause
                  </Button>
                </div>
                
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="h-14 px-6"
                  onClick={() => setSelectedCamera(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};