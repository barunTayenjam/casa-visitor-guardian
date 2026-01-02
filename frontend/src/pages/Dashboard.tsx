import { CameraGrid } from '@/components/dashboard/CameraGrid';
import React, { useState } from 'react';
import { RecentEvents } from '@/components/dashboard/RecentEvents';
import { SystemOverview } from '@/components/dashboard/SystemOverview';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { BatchProcessing } from '@/components/dashboard/BatchProcessing';
import { NoCamerasSetup } from '@/components/NoCamerasSetup';
import { MotionEvent } from '@/types/security';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Maximize2, 
  Grid3X3, 
  LayoutGrid, 
  Clock, 
  Shield, 
  Activity, 
  Users, 
  AlertTriangle, 
  TrendingUp,
  Eye,
  Settings,
  Monitor,
  Bell,
  BellRing,
  CheckCircle2
} from 'lucide-react';
import { useSocketContext } from '@/contexts/SocketContext';
import { useCameras } from '@/contexts/CameraContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import StreamDashboard from './StreamDashboard';
import AdvancedAnalytics from '@/components/analytics/AdvancedAnalytics';

const Dashboard = () => {
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [viewMode, setViewMode] = useState<'streams' | 'overview'>('streams');
  
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStatus, setSystemStatus] = useState({
    armed: true,
    recording: true,
    nightVision: false,
    notifications: true,
    motionDetection: true,
    faceRecognition: true,
    aiAnalysis: true,
    autoCleanup: false
  });
  const { connected } = useSocketContext();
  const { cameras } = useCameras();

  const activeCameras = cameras.filter(c => c.status === 'online');

  // Auto-update time
  React.useEffect(() => {
    if (!autoRefresh) return;
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh]);

  // Handle system actions
  const handleSystemAction = (action: string) => {
    setSystemStatus(prev => {
      switch (action) {
        case 'arm-disarm':
          return { ...prev, armed: !prev.armed };
        case 'recording':
          return { ...prev, recording: !prev.recording };
        case 'night-vision':
          return { ...prev, nightVision: !prev.nightVision };
        case 'notifications':
          return { ...prev, notifications: !prev.notifications };
        case 'motion-detection':
          return { ...prev, motionDetection: !prev.motionDetection };
        case 'face-recognition':
          return { ...prev, faceRecognition: !prev.faceRecognition };
        case 'ai-analysis':
          return { ...prev, aiAnalysis: !prev.aiAnalysis };
        default:
          return prev;
      }
    });
  };

  const stats = React.useMemo(() => ({
    totalCameras: cameras.length,
    onlineCameras: activeCameras.length,
    offlineCameras: cameras.length - activeCameras.length,
    recordingCameras: 0,
    activeMotionCameras: 0,
    totalPersonsDetected: 0,
    totalFacesDetected: 0,
    recentEvents: 0
  }), [cameras, activeCameras]);

  // Return Stream Dashboard as primary view
  if (viewMode === 'streams') {
    return <StreamDashboard />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Simple Header with View Toggle */}
      <div className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Shield className="w-6 h-6 text-blue-500" />
            <div>
              <h1 className="text-xl font-bold text-white">Security Dashboard</h1>
              <p className="text-gray-400 text-sm">
                {currentTime.toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-white">
              <div className={cn("w-2 h-2 rounded-full", connected ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
              <span className="text-sm">{stats.onlineCameras}/{stats.totalCameras} Online</span>
            </div>
            
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'streams' | 'overview')}>
              <TabsList className="bg-slate-800">
                <TabsTrigger value="streams" className="text-white data-[state=active]:bg-slate-700">
                  <Monitor className="w-4 h-4 mr-2" />
                  Streams
                </TabsTrigger>
                <TabsTrigger value="overview" className="text-white data-[state=active]:bg-slate-700">
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Overview Content */}
      {viewMode === 'overview' && (
        <div className="flex-1 overflow-hidden p-6">
          <Tabs defaultValue="cameras" className="w-full h-full">
            <TabsList className="grid w-full grid-cols-5 mb-6 bg-slate-800 rounded-lg p-1">
              <TabsTrigger value="cameras" className="text-white data-[state=active]:bg-slate-700">
                <Monitor className="w-4 h-4 mr-2" />
                Cameras
              </TabsTrigger>
              <TabsTrigger value="overview" className="text-white data-[state=active]:bg-slate-700">
                <LayoutGrid className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="events" className="text-white data-[state=active]:bg-slate-700">
                <Activity className="w-4 h-4 mr-2" />
                Events
              </TabsTrigger>
              <TabsTrigger value="batch" className="text-white data-[state=active]:bg-slate-700">
                <Clock className="w-4 h-4 mr-2" />
                Batch
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-white data-[state=active]:bg-slate-700">
                <TrendingUp className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cameras" className="h-full">
              {cameras.length === 0 ? (
                <NoCamerasSetup />
              ) : (
                <CameraGrid />
              )}
            </TabsContent>

            <TabsContent value="overview" className="h-full space-y-4">
              {cameras.length === 0 ? (
                <NoCamerasSetup />
              ) : (
                <>
                  <SystemOverview
                    cameraStatus={{
                      total: stats.totalCameras,
                      online: stats.onlineCameras,
                      offline: stats.offlineCameras,
                      recording: stats.recordingCameras,
                      activeMotion: stats.activeMotionCameras,
                      personsDetected: stats.totalPersonsDetected,
                      facesDetected: stats.totalFacesDetected
                    }}
                    recentEvents={[]}
                    storage={{
                      total: 1000000,
                      used: 750000,
                      available: 250000,
                      percentage: 75
                    }}
                    alerts={[]}
                    uptime={86400000}
                    cpuUsage={35}
                    memoryUsage={62}
                    networkStatus={'connected'}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="events" className="h-full">
              <div className="flex-1 p-4">
                <RecentEvents onEventSelect={setSelectedEvent} />
              </div>
            </TabsContent>

            <TabsContent value="batch" className="h-full">
              <div className="flex-1 p-4">
                <BatchProcessing />
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="h-full">
              <div className="h-full overflow-y-auto">
                <AdvancedAnalytics />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
