import { CameraGrid } from '@/components/dashboard/CameraGrid';
import { RecentEvents } from '@/components/dashboard/RecentEvents';
import { SystemOverview } from '@/components/dashboard/SystemOverview';
import { useState } from 'react';
import { MotionEvent } from '@/types/security';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, Grid3X3, LayoutGrid } from 'lucide-react';
import { useSocketContext } from '@/contexts/SocketContext';
import { useCameras } from '@/contexts/CameraContext';

const Dashboard = () => {
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'single' | 'overview'>('grid');
  const { connected, connectionStatus } = useSocketContext();
  const { cameras } = useCameras();

  const activeCameras = cameras.filter(c => c.status === 'online');

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with system status and view controls */}
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Live Security Feed</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {connected ? 'Connected' : `${connectionStatus}`}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {activeCameras.length} of {cameras.length} cameras online
            </span>
            <div className="flex items-center gap-1 ml-4">
              <Button
                variant={viewMode === 'overview' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('overview')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'single' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('single')}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'overview' ? (
          /* Overview mode with system stats and recent events */
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            <SystemOverview />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Camera Grid</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="h-[400px]">
                      <CameraGrid compact />
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <RecentEvents onEventSelect={setSelectedEvent} />
              </div>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Full grid mode */
          <div className="flex-1 p-4">
            <CameraGrid />
          </div>
        ) : (
          /* Single camera mode */
          <div className="flex-1 flex">
            <div className="flex-1 p-4">
              <CameraGrid singleView />
            </div>
            <div className="w-80 border-l">
              <RecentEvents onEventSelect={setSelectedEvent} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
