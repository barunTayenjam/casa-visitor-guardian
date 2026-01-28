import { Camera as CameraIcon, Maximize2, Settings, Activity, Layers, Grid3x3, ChevronUp, ChevronDown } from 'lucide-react';
import { CameraGrid } from '@/components/dashboard/CameraGrid';
import { RecentDetectionsCarousel } from '@/components/dashboard/RecentDetectionsCarousel';
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
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">
      {/* Recent Detections Carousel - Above Live Streams */}
      <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700 z-20">
        <RecentDetectionsCarousel limit={12} />
      </div>

      {/* Main Stream View - Takes up most space */}
      <div className="flex-1 relative">
        {viewMode === 'focus' && selectedCameraObj ? (
          /* Focus Mode - Single Large Camera */
          <CameraGrid singleView={true} />
        ) : (
          /* Grid Mode - All Cameras */
          <CameraGrid compact={false} />
        )}
      </div>

      {/* Bottom Control Panel - Compact */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 transition-all duration-300 z-40",
        showControls ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="bg-black/95 backdrop-blur-md border-t border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between gap-6">
            {/* Camera Toggle */}
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode(viewMode === 'grid' ? 'focus' : 'grid')}
              disabled={cameras.length === 0}
            >
              {viewMode === 'grid' ? (
                <><Grid3x3 className="w-4 h-4 mr-2" />Grid</>
              ) : (
                <><Maximize2 className="w-4 h-4 mr-2" />Focus</>
              )}
            </Button>

            {/* Quick Navigation */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
                onClick={() => navigate('/app/camera-config')}
                title="Camera Configuration"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8"
                onClick={() => navigate('/app/events')}
                title="Motion Events"
              >
                <Activity className="w-4 h-4" />
              </Button>
            </div>

            {/* System Status */}
            <div className="flex items-center gap-4 text-white/80 text-xs">
              <span className={cn(activeCameras.length > 0 ? 'text-green-400' : 'text-red-400')}>
                {activeCameras.length}/{cameras.length}
              </span>
              {systemStatus.recording && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span>REC</span>
                </div>
              )}
              {systemStatus.motionDetection && (
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  <span>Motion</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
   );
 };

export default StreamDashboard;