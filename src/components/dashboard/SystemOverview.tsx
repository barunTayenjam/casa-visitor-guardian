
import { Shield, Camera, Activity, HardDrive, Wifi, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SystemStatus } from '@/types/security';
import { useState, useEffect } from 'react';
import { useCameras } from '@/contexts/CameraContext';
import { useEvents } from '@/contexts/EventsContext';
import apiService from '@/services/ApiService';

export const SystemOverview = () => {
  const { cameras, loading: isLoadingCameras } = useCameras();
  const { events } = useEvents(); // EventsContext doesn't have a top-level isLoading

  const [systemData, setSystemData] = useState<SystemStatus>({
    totalCameras: 0,
    onlineCameras: 0,
    totalEvents: 0,
    todayEvents: 0,
    status: 'healthy',
    uptime: 0,
    storageUsed: 0,
    storageTotal: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      
      setSystemData(prev => ({
        ...prev,
        totalEvents: events.length,
        todayEvents: today,
      }));
    }
  }, [events]);

  // Load system data from backend
  useEffect(() => {
    const loadSystemData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load storage and health data in parallel
        const [storageData, healthData] = await Promise.all([
          apiService.getSystemStorage(),
          apiService.getSystemHealth()
        ]);

        setSystemData(prev => ({
          ...prev,
          status: healthData.status,
          uptime: healthData.uptime,
          storageUsed: storageData.used,
          storageTotal: storageData.total,
        }));
      } catch (err) {
        console.error('Failed to load system data:', err);
        setError('Failed to load system information');
      } finally {
        setLoading(false);
      }
    };

    loadSystemData();
    
    // Refresh system data every 30 seconds
    const interval = setInterval(loadSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const storagePercentage = systemData.storageTotal > 0 ? (systemData.storageUsed / systemData.storageTotal) * 100 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className={`status-indicator ${
                  systemData.status === 'healthy' ? 'online' : 
                  systemData.status === 'warning' ? 'warning' : 'offline'
                }`}></div>
                <Badge variant={
                  systemData.status === 'healthy' ? 'default' : 
                  systemData.status === 'warning' ? 'secondary' : 'destructive'
                }>
                  {systemData.status.charAt(0).toUpperCase() + systemData.status.slice(1)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Uptime: {formatUptime(systemData.uptime)}
              </p>
            </>
          )}
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
          <CardTitle className="text-sm font-medium">Storage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-sm text-red-500">Storage info unavailable</div>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {systemData.storageUsed.toFixed(1)}GB
              </div>
              <div className="mt-2">
                <Progress value={storagePercentage} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {storagePercentage.toFixed(1)}% of {systemData.storageTotal}GB used
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
