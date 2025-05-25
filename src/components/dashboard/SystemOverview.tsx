
import { Shield, Camera, Activity, HardDrive, Wifi, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SystemStatus } from '@/types/security';
import { useState, useEffect } from 'react';
import { useCameras } from '@/contexts/CameraContext';
import { useEvents } from '@/contexts/EventsContext';

export const SystemOverview = () => {
  const { cameras, loading: isLoadingCameras } = useCameras();
  const { events } = useEvents(); // EventsContext doesn't have a top-level isLoading

  const [systemData, setSystemData] = useState<SystemStatus>({
    totalCameras: 0,
    onlineCameras: 0,
    // Note: 'totalEvents' from EventsContext is a count of recent events (last 50).
    // A separate API call would be needed for an all-time total.
    totalEvents: 0,
    todayEvents: 0,
    // TODO: Backend API required for these values
    status: 'healthy',
    // TODO: Backend API required for these values
    uptime: 645600, // 7.5 days in seconds
    // TODO: Backend API required for these values
    storageUsed: 156.8,
    // TODO: Backend API required for these values
    storageTotal: 500,
  });

  useEffect(() => {
    if (cameras) {
      const online = cameras.filter(cam => cam.status === 'online').length;
      setSystemData(prev => ({
        ...prev,
        totalCameras: cameras.length,
        onlineCameras: online,
      }));
    }
  }, [cameras]);

  useEffect(() => {
    if (events) {
      const today = events.filter(event => {
        const eventDate = new Date(event.timestamp);
        const todayDate = new Date();
        return eventDate.toDateString() === todayDate.toDateString();
      }).length;
      // Note: 'events.length' represents only recent events (last 50) 
      // as per EventsContext implementation.
      setSystemData(prev => ({
        ...prev,
        totalEvents: events.length,
        todayEvents: today,
      }));
    }
  }, [events]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const storagePercentage = (systemData.storageUsed / systemData.storageTotal) * 100;
  const requiresBackendIndicator = <span className="text-orange-500 ml-1">*</span>;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            System Status {requiresBackendIndicator}
          </CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className={`status-indicator ${systemData.status === 'healthy' ? 'online' : 'warning'}`}></div>
            <Badge variant={systemData.status === 'healthy' ? 'default' : 'destructive'}>
              {systemData.status === 'healthy' ? 'Healthy' : 'Warning'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Uptime: {formatUptime(systemData.uptime)}
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cameras</CardTitle>
          <Camera className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoadingCameras ? (
            <div className="text-sm text-muted-foreground">Loading cameras...</div>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {systemData.onlineCameras}/{systemData.totalCameras}
              </div>
              <p className="text-xs text-muted-foreground">
                {systemData.totalCameras - systemData.onlineCameras > 0 && (
                  <span className="text-yellow-500">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    {systemData.totalCameras - systemData.onlineCameras} offline
                  </span>
                )}
                {systemData.onlineCameras === systemData.totalCameras && systemData.totalCameras > 0 && (
                  <span className="text-green-500">All cameras online</span>
                )}
                 {systemData.totalCameras === 0 && (
                  <span className="text-muted-foreground">No cameras configured</span>
                )}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Events Today</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {/* Events are loaded via socket, so no specific loading state from context, 
              systemData.todayEvents will update from 0 once events arrive */}
          <div className="text-2xl font-bold">{systemData.todayEvents}</div>
          <p className="text-xs text-muted-foreground">
            {systemData.totalEvents} recent events
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Storage {requiresBackendIndicator}
          </CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {systemData.storageUsed}GB
          </div>
          <div className="mt-2">
            <Progress value={storagePercentage} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {storagePercentage.toFixed(1)}% of {systemData.storageTotal}GB used
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
