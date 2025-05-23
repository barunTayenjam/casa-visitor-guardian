
import { Camera as CameraIcon, Play, MoreVertical, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera } from '@/types/security';
import { useState } from 'react';

export const CameraGrid = () => {
  const [cameras] = useState<Camera[]>([
    {
      id: 'cam1',
      name: 'Front Door',
      status: 'online',
      streamUrl: '/stream/cam1',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Main Entrance',
      detectionEnabled: true,
      sensitivity: 0.75,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 30
    },
    {
      id: 'cam2',
      name: 'Backyard',
      status: 'online',
      streamUrl: '/stream/cam2',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Garden Area',
      detectionEnabled: true,
      sensitivity: 0.60,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 30
    },
    {
      id: 'cam3',
      name: 'Garage',
      status: 'offline',
      streamUrl: '/stream/cam3',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Garage Entrance',
      detectionEnabled: false,
      sensitivity: 0.65,
      lastSeen: new Date(Date.now() - 15 * 60 * 1000),
      resolution: '1280x720',
      fps: 15
    },
    {
      id: 'cam4',
      name: 'Driveway',
      status: 'online',
      streamUrl: '/stream/cam4',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Vehicle Area',
      detectionEnabled: true,
      sensitivity: 0.70,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 25
    }
  ]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Live Cameras</h3>
        <Button variant="outline" size="sm">
          View All Cameras
        </Button>
      </div>
      
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
              <div className="camera-stream group cursor-pointer">
                {camera.status === 'online' ? (
                  <div className="relative h-full bg-slate-900 rounded-lg overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="bg-black/50 rounded-full p-4 mb-2 group-hover:bg-black/70 transition-colors">
                          <Play className="h-8 w-8 text-white" />
                        </div>
                        <p className="text-white text-sm font-medium">Click to view live</p>
                        <p className="text-white/60 text-xs">{camera.resolution} • {camera.fps}fps</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full bg-slate-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                      <p className="text-red-500 text-sm font-medium">Camera Offline</p>
                      <p className="text-muted-foreground text-xs">
                        Last seen: {camera.lastSeen.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )}
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
    </div>
  );
};
