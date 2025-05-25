
import { Camera as CameraIcon, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCameras } from '@/contexts/CameraContext';
import { CameraStream } from './CameraStream';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';

export const CameraGrid = () => {
  const { cameras } = useCameras();
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'offline':
        return 'bg-red-500/20 text-red-500 border-red-500/50';
      default:
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
    }
  };

  // Get the currently selected camera
  const currentCamera = cameras.find(c => c.id === selectedCamera);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Live Cameras</h3>
        <Button variant="outline" size="sm">
          View All Cameras
        </Button>
      </div>
      
      {cameras.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="mb-4 flex justify-center">
            <CameraIcon className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Cameras Configured</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No cameras are currently configured in the system. Add a camera to start monitoring.
          </p>
          <Button className="mt-4" variant="default">
            Add Camera
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {cameras.map((camera, index) => (
          <Card key={camera.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{camera.name}</CardTitle>
                  <div className={`status-indicator ${camera.status}`}></div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{camera.location}</p>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Camera stream component */}
              <div onClick={() => setSelectedCamera(camera.id)}>
                <CameraStream camera={camera} />
              </div>
              
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className={getStatusColor(camera.status)}
                >
                  {camera.status.charAt(0).toUpperCase() + camera.status.slice(1)}
                </Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CameraIcon className="h-3 w-3" />
                  Detection: {camera.detectionEnabled ? 'On' : 'Off'}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {/* Fullscreen camera dialog */}
      <Dialog open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <DialogContent className="max-w-5xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{currentCamera?.name || 'Camera Feed'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full">
            {currentCamera && (
              <CameraStream camera={currentCamera} fullscreen />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
