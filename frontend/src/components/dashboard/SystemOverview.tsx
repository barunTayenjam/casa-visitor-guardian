import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity,
  AlertTriangle,
  Camera,
  CameraOff,
  Eye,
  Users,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  HardDrive,
  Wifi,
  WifiOff,
  Shield,
  ShieldCheck,
  Play,
  Pause,
  RotateCw,
  Settings2,
  Download,
  Bell,
  BellRing,
  Info,
  ChevronUp,
  ChevronDown,
  MoreHorizontal
} from 'lucide-react';
import { format, subHours, subDays, subMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface SystemMetric {
  label: string;
  value: number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  icon: React.ReactNode;
  color: string;
}

interface CameraStatus {
  total: number;
  online: number;
  offline: number;
  recording: number;
  activeMotion: number;
  personsDetected: number;
  facesDetected: number;
}

interface Event {
  id: string;
  type: 'motion' | 'person' | 'face' | 'vehicle' | 'animal' | 'other';
  timestamp: Date;
  cameraId: string;
  cameraName: string;
  confidence: number;
  acknowledged: boolean;
  thumbnail?: string;
}

interface StorageMetric {
  total: number;
  used: number;
  available: number;
  percentage: number;
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface SystemOverviewProps {
  cameraStatus: CameraStatus;
  recentEvents: Event[];
  storage: StorageMetric;
  alerts: Alert[];
  uptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  networkStatus?: 'connected' | 'disconnected';
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({
  cameraStatus,
  recentEvents,
  storage,
  alerts,
  uptime,
  cpuUsage,
  memoryUsage,
  networkStatus
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [showDetails, setShowDetails] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Calculate metrics based on time range
  const calculateEventsInRange = () => {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (selectedTimeRange) {
      case '1h':
        cutoffDate = subHours(now, 1);
        break;
      case '6h':
        cutoffDate = subHours(now, 6);
        break;
      case '24h':
        cutoffDate = subDays(now, 1);
        break;
      case '7d':
        cutoffDate = subDays(now, 7);
        break;
    }
    
    return recentEvents.filter(event => event.timestamp >= cutoffDate).length;
  };

  const eventsInRange = calculateEventsInRange();

  const systemMetrics: SystemMetric[] = [
    {
      label: 'Camera Status',
      value: cameraStatus.online,
      unit: `/${cameraStatus.total}`,
      trend: cameraStatus.online > cameraStatus.total * 0.8 ? 'up' : cameraStatus.online < cameraStatus.total * 0.5 ? 'down' : 'stable',
      icon: <Camera className="w-5 h-5" />,
      color: cameraStatus.online > cameraStatus.total * 0.8 ? 'text-green-500' : cameraStatus.online < cameraStatus.total * 0.5 ? 'text-red-500' : 'text-yellow-500'
    },
    {
      label: 'Motion Detection',
      value: eventsInRange,
      unit: 'events',
      trend: 'stable',
      icon: <Activity className="w-5 h-5" />,
      color: 'text-blue-500'
    },
    {
      label: 'Storage Usage',
      value: storage.percentage,
      unit: '%',
      trend: storage.percentage > 80 ? 'up' : storage.percentage > 50 ? 'stable' : 'down',
      icon: <HardDrive className="w-5 h-5" />,
      color: storage.percentage > 80 ? 'text-red-500' : storage.percentage > 50 ? 'text-yellow-500' : 'text-green-500'
    },
    {
      label: 'System Uptime',
      value: Math.floor((uptime || 0) / 3600000),
      unit: 'hours',
      trend: 'stable',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-green-500'
    }
  ];

  // Add CPU and Memory if available
  if (cpuUsage !== undefined && memoryUsage !== undefined) {
    systemMetrics.push({
      label: 'CPU Usage',
      value: cpuUsage,
      unit: '%',
      trend: cpuUsage > 80 ? 'up' : cpuUsage > 50 ? 'stable' : 'down',
      icon: <Zap className="w-5 h-5" />,
      color: cpuUsage > 80 ? 'text-red-500' : cpuUsage > 50 ? 'text-yellow-500' : 'text-green-500'
    });
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'person':
        return <Users className="w-4 h-4 text-blue-400" />;
      case 'face':
        return <UserCheck className="w-4 h-4 text-purple-400" />;
      case 'motion':
        return <Activity className="w-4 h-4 text-yellow-400" />;
      case 'vehicle':
        return <div className="w-4 h-4 bg-gray-600 rounded" />;
      case 'animal':
        return <div className="w-4 h-4 bg-orange-600 rounded-full" />;
      default:
        return <Eye className="w-4 h-4 text-gray-400" />;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'success':
        return <ShieldCheck className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-500" />
            System Overview
          </h2>
          <p className="text-gray-400">
            Real-time monitoring and system health
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Time Range Selector */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['1h', '6h', '24h', '7d'] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={selectedTimeRange === range ? 'default' : 'ghost'}
                className={cn(
                  "text-white",
                  selectedTimeRange === range 
                    ? "bg-slate-700" 
                    : "hover:bg-slate-700"
                )}
                onClick={() => setSelectedTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>

          {/* Auto Refresh */}
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            className={cn(
              "text-white",
              autoRefresh 
                ? "bg-slate-700 hover:bg-slate-600" 
                : "border-slate-600 hover:bg-slate-700"
            )}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RotateCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
          </Button>

          {/* Details Toggle */}
          <Button
            variant="outline"
            size="sm"
            className="text-white border-slate-600 hover:bg-slate-700"
            onClick={() => setShowDetails(!showDetails)}
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* System Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {systemMetrics.map((metric, index) => (
          <Card key={index} className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-lg bg-slate-800", metric.color)}>
                  {metric.icon}
                </div>
                {metric.trend && (
                  <div className={cn(
                    "flex items-center space-x-1 text-xs",
                    metric.trend === 'up' ? 'text-green-500' : 
                    metric.trend === 'down' ? 'text-red-500' : 
                    'text-gray-500'
                  )}>
                    {metric.trend === 'up' && <ChevronUp className="w-4 h-4" />}
                    {metric.trend === 'down' && <ChevronDown className="w-4 h-4" />}
                    <span>
                      {metric.trend === 'up' && '+'}
                      {metric.trend === 'down' && '-'}
                      {Math.abs(metric.trendValue || 0)}%
                    </span>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-gray-400 text-sm mb-1">{metric.label}</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-white">
                    {metric.value}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {metric.unit}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Storage */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-blue-500" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Used</span>
                <span className="text-white">{formatBytes(storage.used)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Available</span>
                <span className="text-gray-300">{formatBytes(storage.available)}</span>
              </div>
              <Progress 
                value={storage.percentage} 
                className="w-full"
              />
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-400">{storage.percentage.toFixed(1)}%</span>
                <span className={cn(
                  "text-xs",
                  storage.percentage > 80 ? 'text-red-500' : 
                  storage.percentage > 50 ? 'text-yellow-500' : 
                  'text-green-500'
                )}>
                  {storage.percentage > 80 ? 'Critical' : storage.percentage > 50 ? 'Warning' : 'Healthy'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center space-x-2">
              <Activity className="w-5 h-5 text-yellow-500" />
              Recent Events ({selectedTimeRange})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {recentEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center space-x-3 p-2 bg-slate-800 rounded-lg">
                  <div className={cn("p-2 rounded-lg", getEventIcon(event.type).props.className)}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm font-medium truncate">
                        {event.cameraName}
                      </p>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded",
                        event.acknowledged ? 'bg-gray-700' : 'bg-blue-600'
                      )}>
                        {event.acknowledged ? 'Acknowledged' : 'New'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs">
                      {format(event.timestamp, 'HH:mm:ss')} • {event.confidence.toFixed(0)}% confidence
                    </p>
                  </div>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  No recent events
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center space-x-2">
              <BellRing className="w-5 h-5 text-red-500" />
              Alerts
              {alerts.filter(a => !a.acknowledged).length > 0 && (
                <Badge className="bg-red-600 text-white">
                  {alerts.filter(a => !a.acknowledged).length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="p-3 bg-slate-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className={cn("p-2 rounded-lg mt-0.5", getAlertIcon(alert.type).props.className)}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white text-sm font-medium">
                          {alert.title}
                        </p>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          alert.type === 'error' ? 'bg-red-600' :
                          alert.type === 'warning' ? 'bg-yellow-600' :
                          alert.type === 'info' ? 'bg-blue-600' :
                          'bg-gray-600'
                        )}>
                          {alert.type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs">
                        {alert.message}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {format(alert.timestamp, 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  No system alerts
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information (when expanded) */}
      {showDetails && (
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Settings2 className="w-5 h-5 text-blue-500" />
              System Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Network Status */}
              <div>
                <h4 className="text-white font-medium mb-3">Network Status</h4>
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    networkStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  )} />
                  <span className="text-white">
                    {networkStatus === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Camera Breakdown */}
              <div>
                <h4 className="text-white font-medium mb-3">Camera Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Cameras</span>
                    <span className="text-white">{cameraStatus.total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Online</span>
                    <span className="text-green-500">{cameraStatus.online}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Offline</span>
                    <span className="text-red-500">{cameraStatus.offline}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Recording</span>
                    <span className="text-yellow-500">{cameraStatus.recording}</span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              {cpuUsage && memoryUsage && (
                <div>
                  <h4 className="text-white font-medium mb-3">Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">CPU Usage</span>
                      <span className={cn(
                        "text-sm",
                        cpuUsage > 80 ? 'text-red-500' : 
                        cpuUsage > 50 ? 'text-yellow-500' : 
                        'text-green-500'
                      )}>
                        {cpuUsage}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Memory Usage</span>
                      <span className={cn(
                        "text-sm",
                        memoryUsage > 80 ? 'text-red-500' : 
                        memoryUsage > 50 ? 'text-yellow-500' : 
                        'text-green-500'
                      )}>
                        {memoryUsage}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Detection Statistics */}
              <div>
                <h4 className="text-white font-medium mb-3">Detection Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Persons Detected</span>
                    <span className="text-blue-500">{cameraStatus.personsDetected}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Faces Recognized</span>
                    <span className="text-purple-500">{cameraStatus.facesDetected}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Active Motion</span>
                    <span className="text-yellow-500">{cameraStatus.activeMotion}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SystemOverview;