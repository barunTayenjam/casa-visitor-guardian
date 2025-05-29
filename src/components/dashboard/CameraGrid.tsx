import { Camera as CameraIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCameras } from '@/contexts/CameraContext';
import { CameraStream } from './CameraStream';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useState } from 'react';

export const CameraGrid = () => {
  const { cameras } = useCameras();
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const currentCamera = cameras.find(c => c.id === selectedCamera);

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
      ) : (
        <div className="grid gap-2 auto-rows-fr h-[calc(100vh-4rem)]" 
             style={{ 
               gridTemplateColumns: `repeat(${Math.min(cameras.length, 3)}, 1fr)`,
             }}>
          {cameras.map((camera) => (
            <div
              key={camera.id}
              className="relative bg-black rounded-lg overflow-hidden cursor-pointer"
              onClick={() => setSelectedCamera(camera.id)}
            >
              <CameraStream camera={camera} />
              <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {camera.name}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          {currentCamera && (
            <div className="relative w-full h-full bg-black">
              <CameraStream camera={currentCamera} fullscreen />
              <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg">
                {currentCamera.name}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
