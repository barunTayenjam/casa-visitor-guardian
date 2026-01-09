import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  UserCheck, 
  Eye, 
  Calendar,
  Download,
  RefreshCw,
  Activity,
  Clock,
  Target,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import apiService from '@/services/ApiService';

interface DetectionStats {
  totalDetections: number;
  personDetections: number;
  faceDetections: number;
  knownFaces: number;
  unknownFaces: number;
  averageConfidence: number;
  processingTime: number;
  accuracy: number;
}

interface TimeSeriesData {
  timestamp: string;
  count: number;
  confidence: number;
}

interface CameraPerformance {
  cameraId: string;
  cameraName: string;
  totalDetections: number;
  averageConfidence: number;
  processingTime: number;
  uptime: number;
}

interface DetectionTypeDistribution {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

interface DetectionAnalyticsProps {
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export const DetectionAnalytics: React.FC<DetectionAnalyticsProps> = ({
  timeRange,
  onTimeRangeChange
}) => {
  const { toast } = useToast();
  
  // State
  const [stats, setStats] = useState<DetectionStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [cameraPerformance, setCameraPerformance] = useState<CameraPerformance[]>([]);
  const [detectionTypes, setDetectionTypes] = useState<DetectionTypeDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'detections' | 'confidence' | 'accuracy'>('detections');

  const loadAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      let stats: DetectionStats | null = null;
      let timeSeriesData: TimeSeriesData[] = [];
      let cameraPerformanceData: CameraPerformance[] = [];
      let detectionTypeData: DetectionTypeDistribution[] = [];

      // Get batch stats for overall statistics
      try {
        const batchStats = await apiService.getBatchStats();
        if (batchStats) {
          stats = {
            totalDetections: (batchStats.totalPersonDetections || 0) + (batchStats.totalFaceDetections || 0),
            personDetections: batchStats.totalPersonDetections || 0,
            faceDetections: batchStats.totalFaceDetections || 0,
            knownFaces: 0,
            unknownFaces: 0,
            averageConfidence: 0,
            processingTime: batchStats.totalProcessingTime || 0,
            accuracy: 0
          };
        }
      } catch (error) {
        console.warn('Could not load batch stats:', error);
      }

      // Get time series data based on time range
      try {
        let analyticsData;
        if (timeRange === 'today') {
          analyticsData = await apiService.getHourlyAnalytics();
        } else if (timeRange === 'week') {
          analyticsData = await apiService.getWeeklyAnalytics();
        } else if (timeRange === 'month') {
          analyticsData = await apiService.getMonthlyAnalytics();
        }

        if (analyticsData) {
          if (timeRange === 'today' && analyticsData.hourlyData) {
            timeSeriesData = analyticsData.hourlyData.map((d: any) => ({
              timestamp: new Date().toISOString(),
              count: d.count,
              confidence: 0
            }));
          } else if (timeRange === 'week' && analyticsData.weeklyData?.dailyBreakdown) {
            timeSeriesData = analyticsData.weeklyData.dailyBreakdown.map((d: any) => ({
              timestamp: d.date,
              count: d.count,
              confidence: 0
            }));
          } else if (timeRange === 'month' && analyticsData.monthlyData?.weeklyBreakdown) {
            timeSeriesData = analyticsData.monthlyData.weeklyBreakdown.map((d: any) => ({
              timestamp: d.weekStart,
              count: d.totalEvents,
              confidence: 0
            }));
          }
        }
      } catch (error) {
        console.warn('Could not load time series data:', error);
      }

      setStats(stats);
      setTimeSeriesData(timeSeriesData);
      setCameraPerformance(cameraPerformanceData);
      setDetectionTypes(detectionTypeData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load analytics data
  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData, timeRange]);

  const exportAnalytics = async () => {
    try {
      const analyticsData = {
        stats,
        timeSeriesData,
        cameraPerformance,
        detectionTypes,
        timeRange,
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `detection-analytics-${timeRange}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Analytics data exported successfully",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data",
        variant: "destructive",
      });
    }
  };

  const refreshAnalytics = () => {
    loadAnalyticsData();
  };

  const getMetricData = () => {
    switch (selectedMetric) {
      case 'confidence':
        return timeSeriesData.map(d => ({ ...d, value: d.confidence * 100 }));
      case 'accuracy':
        return timeSeriesData.map(d => ({ ...d, value: d.confidence * 100 })); // Use confidence as fallback for accuracy
      default:
        return timeSeriesData.map(d => ({ ...d, value: d.count }));
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'confidence':
        return 'text-green-600';
      case 'accuracy':
        return 'text-blue-600';
      default:
        return 'text-purple-600';
    }
  };

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'confidence':
        return 'Avg Confidence (%)';
      case 'accuracy':
        return 'Accuracy (%)';
      default:
        return 'Detection Count';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading analytics...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detection Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights from detection activities
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={refreshAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button onClick={exportAnalytics} variant="outline" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.totalDetections || 0}</div>
            <p className="text-sm text-muted-foreground">Total Detections</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.personDetections || 0}</div>
            <p className="text-sm text-muted-foreground">Person Detections</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.faceDetections || 0}</div>
            <p className="text-sm text-muted-foreground">Face Detections</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{Math.round((stats?.accuracy || 0) * 100)}%</div>
            <p className="text-sm text-muted-foreground">Accuracy Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Time Series Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Detection Trends
              </span>
              <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="detections">Detection Count</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="accuracy">Accuracy</SelectItem>
                </SelectContent>
              </Select>
            </CardTitle>
            <CardDescription>
              {getMetricLabel()} over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between space-x-1">
              {getMetricData().map((data, index) => (
                <div
                  key={index}
                  className="flex-1 bg-blue-500 rounded-t relative group cursor-pointer hover:bg-blue-600"
                  style={{ height: `${(data.value / 100) * 100}%` }}
                  title={`${new Date(data.timestamp).toLocaleTimeString()}: ${data.value.toFixed(1)}`}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {data.value.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Start: {new Date(timeSeriesData[0]?.timestamp).toLocaleString()}</span>
              <span>End: {new Date(timeSeriesData[timeSeriesData.length - 1]?.timestamp).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Detection Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Detection Types
            </CardTitle>
            <CardDescription>
              Distribution of detection categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {detectionTypes.map((type, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded ${type.color}`} />
                    <span className="font-medium">{type.type}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{type.count}</div>
                    <div className="text-sm text-muted-foreground">{type.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Visual Distribution */}
            <div className="mt-4 h-4 flex rounded-full overflow-hidden">
              {detectionTypes.map((type, index) => (
                <div
                  key={index}
                  className={`${type.color} transition-all`}
                  style={{ width: `${type.percentage}%` }}
                  title={`${type.type}: ${type.count} (${type.percentage}%)`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="mr-2 h-5 w-5" />
            Camera Performance
          </CardTitle>
          <CardDescription>
            Detection performance by camera
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cameraPerformance.map((camera, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{camera.cameraName}</h4>
                    <p className="text-sm text-muted-foreground">{camera.cameraId}</p>
                  </div>
                  <Badge variant={camera.uptime > 0.9 ? 'default' : 'secondary'}>
                    {Math.round(camera.uptime * 100)}% uptime
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Detections:</span>
                    <span className="font-medium ml-1">{camera.totalDetections}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Confidence:</span>
                    <span className="font-medium ml-1">{Math.round(camera.averageConfidence * 100)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Processing Time:</span>
                    <span className="font-medium ml-1">{camera.processingTime}ms</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={camera.uptime > 0.9 ? 'default' : 'destructive'} className="ml-1">
                      {camera.uptime > 0.9 ? 'Healthy' : 'Issues'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-sm">
              <Users className="mr-2 h-4 w-4" />
              Face Recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Known Faces:</span>
                <span className="font-medium">{stats?.knownFaces || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Unknown Faces:</span>
                <span className="font-medium">{stats?.unknownFaces || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Recognition Rate:</span>
                <span className="font-medium">
                  {stats?.faceDetections > 0 
                    ? Math.round((stats.knownFaces / stats.faceDetections) * 100) 
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-sm">
              <Zap className="mr-2 h-4 w-4" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Avg Confidence:</span>
                <span className="font-medium">{Math.round((stats?.averageConfidence || 0) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Processing:</span>
                <span className="font-medium">{stats?.processingTime || 0}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Overall Accuracy:</span>
                <span className="font-medium">{Math.round((stats?.accuracy || 0) * 100)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-sm">
              <Activity className="mr-2 h-4 w-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Service Status:</span>
                <Badge variant="default">Operational</Badge>
              </div>
              <div className="flex justify-between">
                <span>Last Update:</span>
                <span className="font-medium">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Data Points:</span>
                <span className="font-medium">{timeSeriesData.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetectionAnalytics;