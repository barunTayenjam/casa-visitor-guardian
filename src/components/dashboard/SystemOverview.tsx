
import { Shield, Camera, Activity, HardDrive, Wifi, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SystemStatus } from '@/types/security';
import { useState } from 'react';

export const SystemOverview = () => {
  const [systemStatus] = useState<SystemStatus>({
    status: 'healthy',
    uptime: 645600, // 7.5 days in seconds
    totalCameras: 4,
    onlineCameras: 3,
    totalEvents: 847,
    todayEvents: 23,
    storageUsed: 156.8,
    storageTotal: 500
  });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const storagePercentage = (systemStatus.storageUsed / systemStatus.storageTotal) * 100;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className={`status-indicator ${systemStatus.status === 'healthy' ? 'online' : 'warning'}`}></div>
            <Badge variant={systemStatus.status === 'healthy' ? 'default' : 'destructive'}>
              {systemStatus.status === 'healthy' ? 'Healthy' : 'Warning'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Uptime: {formatUptime(systemStatus.uptime)}
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cameras</CardTitle>
          <Camera className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {systemStatus.onlineCameras}/{systemStatus.totalCameras}
          </div>
          <p className="text-xs text-muted-foreground">
            {systemStatus.totalCameras - systemStatus.onlineCameras > 0 && (
              <span className="text-yellow-500">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                {systemStatus.totalCameras - systemStatus.onlineCameras} offline
              </span>
            )}
            {systemStatus.onlineCameras === systemStatus.totalCameras && (
              <span className="text-green-500">All cameras online</span>
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Events Today</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemStatus.todayEvents}</div>
          <p className="text-xs text-muted-foreground">
            {systemStatus.totalEvents} total events
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Storage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {systemStatus.storageUsed}GB
          </div>
          <div className="mt-2">
            <Progress value={storagePercentage} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {storagePercentage.toFixed(1)}% of {systemStatus.storageTotal}GB used
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
