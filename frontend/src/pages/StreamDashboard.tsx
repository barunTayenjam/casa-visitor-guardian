import { Camera as CameraIcon, Maximize2, Settings, Activity, Bell, Eye, Layers, Grid3x3, ChevronUp, ChevronDown } from 'lucide-react';
import { CameraGrid } from '@/components/dashboard/CameraGrid';
import { useCameras } from '@/contexts/CameraContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const StreamDashboard = () => {
  const { cameras } = useCameras();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'single' | 'focus'>('grid');
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    recording: true,
    motionDetection: true,
    aiAnalysis: true,
    nightVision: false
  });

  const activeCameras = cameras.filter(c => c.status === 'online');
  const selectedCameraObj = cameras.find(c => c.id === selectedCamera);

  const handleSystemAction = (action: string) => {
    setSystemStatus(prev => {
      switch (action) {
        case 'recording':
          return { ...prev, recording: !prev.recording };
        case 'motion-detection':
          return { ...prev, motionDetection: !prev.motionDetection };
        case 'ai-analysis':
          return { ...prev, aiAnalysis: !prev.aiAnalysis };
        case 'night-vision':
          return { ...prev, nightVision: !prev.nightVision };
        default:
          return prev;
      }
    });
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Main Stream View - Full Screen */}
      <div className="absolute inset-0">
        {viewMode === 'focus' && selectedCameraObj ? (
          /* Focus Mode - Single Large Camera */
          <div className="h-full flex flex-col">
            <div className="flex-1 relative">
              <CameraGrid singleView={true} />
            </div>
          </div>
        ) : (
          /* Grid Mode - All Cameras */
          <CameraGrid compact={false} />
        )}
      </div>

      {/* Bottom Slide-Up Control Panel */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 transition-all duration-300 z-50",
        showControls ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="bg-black/90 backdrop-blur-md border-t border-gray-700">
          {/* Handle for dragging */}
          <div 
            className="flex justify-center py-2 cursor-pointer"
            onClick={() => setShowControls(!showControls)}
          >
            <div className="w-12 h-1 bg-gray-500 rounded-full"></div>
          </div>
          
          <Card className="bg-transparent border-0 shadow-none rounded-none">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Camera Controls */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Cameras</span>
                    <span className="text-sm text-gray-400">
                      {activeCameras.length}/{cameras.length} Online
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid3x3 className="w-4 h-4 mr-1" />
                      Grid
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'focus' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => {
                        if (cameras.length > 0) {
                          setSelectedCamera(cameras[0].id);
                          setViewMode('focus');
                        }
                      }}
                      disabled={cameras.length === 0}
                    >
                      <Maximize2 className="w-4 h-4 mr-1" />
                      Focus
                    </Button>
                  </div>

                  {/* Camera Selector for Focus Mode */}
                  {viewMode === 'focus' && cameras.length > 1 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between">
                          <Eye className="w-4 h-4 mr-2" />
                          {selectedCameraObj?.name || 'Select Camera'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-black/90 border-gray-700">
                        <DropdownMenuLabel className="text-gray-300">Select Camera</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {cameras.map((camera) => (
                          <DropdownMenuItem
                            key={camera.id}
                            onClick={() => setSelectedCamera(camera.id)}
                            className="text-white hover:bg-gray-800"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{camera.name}</span>
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                camera.status === 'online' ? 'bg-green-500' : 
                                camera.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                              )} />
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* System Controls */}
                <div className="space-y-4">
                  <div className="text-white font-medium">System</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {systemStatus.recording && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                        <span className="text-xs text-gray-300">Recording</span>
                      </div>
                      <Switch
                        checked={systemStatus.recording}
                        onCheckedChange={() => handleSystemAction('recording')}
                        size="sm"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        <span className="text-xs text-gray-300">Motion</span>
                      </div>
                      <Switch
                        checked={systemStatus.motionDetection}
                        onCheckedChange={() => handleSystemAction('motion-detection')}
                        size="sm"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="w-3 h-3" />
                        <span className="text-xs text-gray-300">AI Analysis</span>
                      </div>
                      <Switch
                        checked={systemStatus.aiAnalysis}
                        onCheckedChange={() => handleSystemAction('ai-analysis')}
                        size="sm"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CameraIcon className="w-3 h-3" />
                        <span className="text-xs text-gray-300">Night Vision</span>
                      </div>
                      <Switch
                        checked={systemStatus.nightVision}
                        onCheckedChange={() => handleSystemAction('night-vision')}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="space-y-4">
                  <div className="text-white font-medium">Navigation</div>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => navigate('/app/camera-config')}
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      Camera Configuration
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => navigate('/app/events')}
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Motion Events
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => navigate('/app/settings')}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      System Settings
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Toggle Controls Button - Top Right */}
      <Button
        className="absolute top-4 right-4 z-40"
        variant="outline"
        size="sm"
        onClick={() => setShowControls(!showControls)}
      >
        {showControls ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </Button>

      {/* Minimal Status Bar - Top Left */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-lg z-40">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", activeCameras.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
            <span>{activeCameras.length}/{cameras.length} Online</span>
          </div>
          {systemStatus.recording && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>Recording</span>
            </div>
          )}
          {systemStatus.motionDetection && (
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              <span>Motion</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamDashboard;