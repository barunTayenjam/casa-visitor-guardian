
import { Camera as CameraIcon, Play, Settings, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCameras } from '@/contexts/CameraContext';

const Cameras = () => {
  const { cameras } = useCameras();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Cameras</h1>
          <p className="text-muted-foreground mt-2">
            Monitor all camera feeds and manage settings
          </p>
        </div>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Camera Settings
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {cameras.map((camera) => (
          <Card key={camera.id} className="animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{camera.name}</CardTitle>
                  <div className={`status-indicator ${camera.status}`}></div>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{camera.location}</p>
                <Badge variant={camera.status === 'online' ? 'default' : 'destructive'}>
                  {camera.status}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="camera-stream aspect-video group cursor-pointer">
                {camera.status === 'online' ? (
                  <div className="relative h-full bg-slate-900 rounded-lg overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="bg-black/50 rounded-full p-6 mb-3 group-hover:bg-black/70 transition-colors">
                          <Play className="h-10 w-10 text-white" />
                        </div>
                        <p className="text-white text-lg font-medium">Live Stream</p>
                        <p className="text-white/60 text-sm">{camera.resolution} • {camera.fps}fps</p>
                        <p className="text-white/40 text-xs mt-1">RTSP: {camera.streamUrl.split('@')[1]?.split(':')[0] || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full bg-slate-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <CameraIcon className="h-12 w-12 text-red-500 mx-auto mb-3" />
                      <p className="text-red-500 font-medium">Camera Offline</p>
                      <p className="text-muted-foreground text-sm">
                        Last seen: {camera.lastSeen.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    Detection: {camera.detectionEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="text-muted-foreground">
                    Sensitivity: {Math.round(camera.sensitivity * 100)}%
                  </span>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Cameras;
