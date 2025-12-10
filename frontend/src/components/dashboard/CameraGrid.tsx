import { Camera as CameraIcon, Eye, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCameras } from '@/contexts/CameraContext';
import { CameraStream } from './CameraStream';
import { DetectionControl } from './DetectionControl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

interface CameraGridProps {
  compact?: boolean;
  singleView?: boolean;
}

export const CameraGrid = ({ compact = false, singleView = false }: CameraGridProps) => {
  const { cameras, loading, error } = useCameras();
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const currentCamera = cameras.find(c => c.id === selectedCamera);

  console.log('*** CameraGrid RENDERING WITH ORIGINAL CameraStream COMPONENT ***', { cameras, loading, error });

  if (loading) {
    return (
      <Card className="p-6 text-center">
        <div className="mb-4 flex justify-center">
          <CameraIcon className="h-12 w-12 text-muted-foreground animate-pulse" />
        </div>
        <h3 className="text-lg font-medium">Loading Cameras...</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we load your camera configuration.
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <div className="mb-4 flex justify-center">
          <CameraIcon className="h-12 w-12 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-red-600">Error Loading Cameras</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {error}
        </p>
      </Card>
    );
  }

  return (
    <>
      {cameras.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="mb-4 flex justify-center">
            <CameraIcon className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Cameras Configured</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No cameras are currently configured in the system.
          </p>
        </Card>
      ) : singleView ? (
          /* Single view mode - show one large camera with thumbnails */
          <div className="h-full flex flex-col gap-2">
            <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
              <CameraStream camera={selectedCamera ? currentCamera! : cameras[0]} />
              <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {(selectedCamera ? currentCamera?.name : cameras[0]?.name) || 'No Camera'}
              </div>
            </div>
            {cameras.length > 1 && (
              <div className="flex gap-2 h-20">
                {cameras.map((camera) => (
                  <div
                    key={camera.id}
                    className={`relative bg-black rounded overflow-hidden cursor-pointer flex-1 ${
                      (selectedCamera || cameras[0].id) === camera.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedCamera(camera.id)}
                  >
                    <CameraStream camera={camera} autoStart={false} />
                    <div className="absolute bottom-1 left-1 bg-black/50 text-white px-1 py-0.5 rounded text-xs">
                      {camera.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Grid mode */
          <div 
            className={`grid gap-2 ${compact ? 'h-full' : 'h-[calc(100vh-4rem)]'}`}
            style={{ 
              gridTemplateColumns: cameras.length === 1 ? '1fr' : 
                                  cameras.length === 2 ? 'repeat(2, 1fr)' : 
                                  compact ? 'repeat(2, 1fr)' :
                                  'repeat(3, 1fr)',
              gridTemplateRows: cameras.length <= 3 ? '1fr' : 
                                cameras.length <= 6 ? 'repeat(2, 1fr)' : 
                                compact ? 'repeat(2, 1fr)' :
                                'repeat(3, 1fr)'
            }}
          >
            {cameras.map((camera) => (
              <div
                key={camera.id}
                className="relative bg-black rounded-lg overflow-hidden cursor-pointer aspect-video"
                onClick={() => setSelectedCamera(camera.id)}
              >
                <CameraStream camera={camera} />
                <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                  {camera.name}
                </div>
                {/* Status indicator */}
                <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                  camera.status === 'online' ? 'bg-green-500' : 
                  camera.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              </div>
            ))}
          </div>
        )}

      <Dialog open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] w-full">
          {currentCamera && (
            <div className="flex flex-col h-full">
              <DialogHeader className="pb-4">
                <DialogTitle className="flex items-center gap-2">
                  <CameraIcon className="h-5 w-5" />
                  {currentCamera.name}
                  <span className={`px-2 py-1 rounded text-xs ${
                    currentCamera.status === 'online' ? 'bg-green-100 text-green-800' : 
                    currentCamera.status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                  }`}>
                    {currentCamera.status}
                  </span>
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="stream" className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="stream" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Live Stream
                  </TabsTrigger>
                  <TabsTrigger value="detection" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Detection Controls
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="stream" className="flex-1 mt-4">
                  <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ height: 'calc(90vh - 200px)' }}>
                    <CameraStream camera={currentCamera} fullscreen />
                    <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg">
                      {currentCamera.name} - Live
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="detection" className="flex-1 mt-4">
                  <div className="space-y-4">
                    <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ height: '400px' }}>
                      <CameraStream camera={currentCamera} />
                      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg">
                        {currentCamera.name} - Detection View
                      </div>
                    </div>
                    
                    <DetectionControl 
                      camera={currentCamera}
                      onDetectionResult={(result) => {
                        console.log('Detection result:', result);
                        // You can show a toast or update state here
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
