import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  HardDrive, 
  Cpu, 
  Activity, 
  Camera, 
  Bell, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock
} from 'lucide-react';
import apiService from '@/services/ApiService';
import { useCameras } from '@/contexts/CameraContext';
// import { useDebug } from '@/contexts/DebugContext';

interface SystemHealth {
  status: string;
  uptime: number;
  issues: string[];
  cameras: { total: number; online: number; offline: number };
  memory: { used: number; total: number };
  events: { recent: number; today: number };
}

interface StorageInfo {
  used: number;
  total: number;
  eventsSize: number;
  snapshotsSize: number;
  percentage: number;
}

export const TabletSystemMonitor = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { cameras } = useCameras();
  // const { debugEnabled, toggleDebug } = useDebug();
  const debugEnabled = false;
  const toggleDebug = () => console.log('Debug toggle clicked');

  const loadSystemData = async () => {
    try {
      setLoading(true);
      const [health, storage] = await Promise.all([
        apiService.getSystemHealth(),
        apiService.getSystemStorage()
      ]);
      
      setSystemHealth(health);
      setStorageInfo(storage);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading system data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'good':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'error':
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'good':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Activity className="h-6 w-6 text-muted-foreground" />;
    }
  };

  if (loading && !systemHealth) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-12 text-center max-w-md">
          <Activity className="h-16 w-16 text-muted-foreground animate-pulse mx-auto mb-6" />
          <h3 className="text-2xl font-medium mb-4">Loading System Status...</h3>
          <p className="text-lg text-muted-foreground">
            Please wait while we gather system information.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">System Monitor</h2>
          <p className="text-lg text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button 
          onClick={loadSystemData} 
          disabled={loading}
          size="lg"
          className="h-12 px-6"
        >
          <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Overall Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">System Status</p>
              <p className={`text-2xl font-bold ${getStatusColor(systemHealth?.status || 'unknown')}`}>
                {systemHealth?.status || 'Unknown'}
              </p>
            </div>
            {getStatusIcon(systemHealth?.status || 'unknown')}
          </div>
        </Card>

        {/* Uptime */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Uptime</p>
              <p className="text-2xl font-bold">
                {systemHealth ? formatUptime(systemHealth.uptime) : '--'}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        {/* Active Cameras */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cameras Online</p>
              <p className="text-2xl font-bold">
                {systemHealth?.cameras.online || 0}/{systemHealth?.cameras.total || 0}
              </p>
            </div>
            <Camera className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        {/* Recent Events */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Events Today</p>
              <p className="text-2xl font-bold">
                {systemHealth?.events.today || 0}
              </p>
            </div>
            <Bell className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Detailed Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-6 w-6" />
              Storage Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {storageInfo && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Total Storage</span>
                    <span className="text-sm text-muted-foreground">
                      {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.total)}
                    </span>
                  </div>
                  <Progress value={storageInfo.percentage} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {storageInfo.percentage.toFixed(1)}% used
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Events</p>
                    <p className="text-lg font-bold">{formatBytes(storageInfo.eventsSize)}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Snapshots</p>
                    <p className="text-lg font-bold">{formatBytes(storageInfo.snapshotsSize)}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-6 w-6" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {systemHealth && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">RAM Usage</span>
                    <span className="text-sm text-muted-foreground">
                      {formatBytes(systemHealth.memory.used)} / {formatBytes(systemHealth.memory.total)}
                    </span>
                  </div>
                  <Progress 
                    value={(systemHealth.memory.used / systemHealth.memory.total) * 100} 
                    className="h-3" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((systemHealth.memory.used / systemHealth.memory.total) * 100).toFixed(1)}% used
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">System Issues</h4>
                  {systemHealth.issues.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">No issues detected</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {systemHealth.issues.map((issue, index) => (
                        <div key={index} className="flex items-center gap-2 text-yellow-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Debug Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Debug Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Debug Mode</h4>
              <p className="text-sm text-muted-foreground">
                Show debug information and data panels throughout the app
              </p>
            </div>
            <Button
              onClick={toggleDebug}
              variant={debugEnabled ? "default" : "outline"}
              size="lg"
              className="h-12 px-6"
            >
              {debugEnabled ? "Disable" : "Enable"} Debug
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Camera Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-6 w-6" />
            Camera Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cameras.map((camera) => (
              <div key={camera.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    camera.status === 'online' ? 'bg-green-500' : 
                    camera.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">{camera.name}</p>
                    <p className="text-sm text-muted-foreground">{camera.location}</p>
                  </div>
                </div>
                <Badge 
                  variant={camera.status === 'online' ? 'default' : 'destructive'}
                  className="capitalize"
                >
                  {camera.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};