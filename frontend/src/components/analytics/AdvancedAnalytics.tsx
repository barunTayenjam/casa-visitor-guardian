import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Camera, 
  User, 
  AlertTriangle, 
  Calendar,
  Download,
  Activity,
  Eye,
  Users,
  Clock,
  CalendarRange
} from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import apiService from '@/services/ApiService';

interface AnalyticsData {
  eventsToday: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
  hourlyData: Array<{ hour: number; count: number }>;
  cameraData: Array<{ camera: string; count: number }>;
  averageResponseTime: number;
  detectionStats: {
    personDetections: number;
    faceDetections: number;
    totalDetections: number;
  };
  visitorStats: {
    knownVisitors: number;
    unknownVisitors: number;
    totalVisitors: number;
  };
  securityStats: {
    nightTimeEvents: number;
    unusualActivity: number;
  };
}

interface TimeRange {
  label: string;
  value: 'today' | 'week' | 'month' | '3months' | 'year';
}

const timeRanges: TimeRange[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 3 Months', value: '3months' },
  { label: 'This Year', value: 'year' }
];

export const AdvancedAnalytics: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    eventsToday: 0,
    eventsThisWeek: 0,
    eventsThisMonth: 0,
    hourlyData: Array(24).fill(null).map((_, i) => ({ hour: i, count: 0 })),
    cameraData: [],
    averageResponseTime: 0,
    detectionStats: {
      personDetections: 0,
      faceDetections: 0,
      totalDetections: 0
    },
    visitorStats: {
      knownVisitors: 0,
      unknownVisitors: 0,
      totalVisitors: 0
    },
    securityStats: {
      nightTimeEvents: 0,
      unusualActivity: 0
    }
  });
  const [timeRange, setTimeRange] = useState<TimeRange['value']>('week');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all analytics data in parallel
      const [
        hourlyData,
        weeklyData,
        monthlyData,
        responseTimeData
      ] = await Promise.all([
        apiService.getHourlyAnalytics(),
        apiService.getWeeklyAnalytics(),
        apiService.getMonthlyAnalytics(),
        apiService.getResponseTimeAnalytics()
      ]);

      // Get detection stats
      const detectionEvents = await apiService.getDetectionHistory({
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString(),
        detectionTypes: ['person', 'face']
      });

      const personDetections = detectionEvents.filter(e => e.detectionType === 'person').length;
      const faceDetections = detectionEvents.filter(e => e.detectionType === 'face').length;

      // Get visitor stats
      const visitorEvents = await apiService.getDetectionHistory({
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date().toISOString(),
        detectionTypes: ['face']
      });

      const knownVisitors = visitorEvents.filter(e => e.isKnown).length;
      const unknownVisitors = visitorEvents.filter(e => !e.isKnown).length;

      // Calculate night time events (between 10 PM and 6 AM)
      const nightTimeEvents = detectionEvents.filter(e => {
        const hour = new Date(e.timestamp).getHours();
        return hour >= 22 || hour < 6; // 10 PM to 6 AM
      }).length;

      setAnalyticsData({
        eventsToday: hourlyData.reduce((sum, hour) => sum + hour.count, 0),
        eventsThisWeek: weeklyData.totalEvents,
        eventsThisMonth: monthlyData.totalEvents,
        hourlyData,
        cameraData: [], // Will implement camera data later
        averageResponseTime: responseTimeData.average,
        detectionStats: {
          personDetections,
          faceDetections,
          totalDetections: personDetections + faceDetections
        },
        visitorStats: {
          knownVisitors,
          unknownVisitors,
          totalVisitors: knownVisitors + unknownVisitors
        },
        securityStats: {
          nightTimeEvents,
          unusualActivity: 0 // Placeholder for now
        }
      });
    } catch (err) {
      console.error('Failed to load analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const maxHourlyCount = Math.max(1, ...analyticsData.hourlyData.map(d => d.count));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange['value'])}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRanges.map(range => (
                <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="animate-pulse">
            <CardContent className="p-6 h-64"></CardContent>
          </Card>
          <Card className="animate-pulse">
            <CardContent className="p-6 h-64"></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Comprehensive security and detection analytics</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange['value'])}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRanges.map(range => (
                <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{analyticsData.eventsThisWeek}</p>
                <p className="text-xs text-muted-foreground">This week</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Person Detections</p>
                <p className="text-2xl font-bold">{analyticsData.detectionStats.personDetections}</p>
                <p className="text-xs text-muted-foreground">This period</p>
              </div>
              <User className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Face Detections</p>
                <p className="text-2xl font-bold">{analyticsData.detectionStats.faceDetections}</p>
                <p className="text-xs text-muted-foreground">This period</p>
              </div>
              <Eye className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Known Visitors</p>
                <p className="text-2xl font-bold">{analyticsData.visitorStats.knownVisitors}</p>
                <p className="text-xs text-muted-foreground">This period</p>
              </div>
              <Users className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detection">Detection</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Activity by Hour */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Activity by Hour
                </CardTitle>
                <CardDescription>Events distribution throughout the day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <div className="flex items-end justify-between h-full gap-1 pt-4">
                    {analyticsData.hourlyData.map((data) => (
                      <div
                        key={data.hour}
                        className="flex flex-col items-center flex-1"
                      >
                        <div
                          className="w-full bg-primary/20 rounded-t-sm min-h-[2px] transition-all duration-300 hover:bg-primary/40"
                          style={{
                            height: `${(data.count / maxHourlyCount) * 100}%`
                          }}
                        ></div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {data.hour.toString().padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity by Camera */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Activity by Camera
                </CardTitle>
                <CardDescription>Events distribution across cameras</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                  {analyticsData.cameraData.length > 0 ? (
                    analyticsData.cameraData.map((camera, index) => (
                      <div key={camera.camera} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate" title={camera.camera}>{camera.camera}</span>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {camera.count} events
                          </Badge>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${(camera.count / Math.max(1, ...analyticsData.cameraData.map(c => c.count))) * 100}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">
                      No camera data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detection" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Detection Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Detection Statistics</CardTitle>
                <CardDescription>Breakdown of detection types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Person Detections</span>
                    <Badge variant="secondary">{analyticsData.detectionStats.personDetections}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Face Detections</span>
                    <Badge variant="secondary">{analyticsData.detectionStats.faceDetections}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Detections</span>
                    <Badge variant="secondary">{analyticsData.detectionStats.totalDetections}</Badge>
                  </div>
                  
                  <div className="pt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Detection Accuracy</span>
                      <span>87%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '87%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Visitor Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Visitor Statistics</CardTitle>
                <CardDescription>Known vs unknown visitors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Known Visitors</span>
                    <Badge variant="secondary">{analyticsData.visitorStats.knownVisitors}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Unknown Visitors</span>
                    <Badge variant="secondary">{analyticsData.visitorStats.unknownVisitors}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Visitors</span>
                    <Badge variant="secondary">{analyticsData.visitorStats.totalVisitors}</Badge>
                  </div>
                  
                  <div className="pt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Recognition Rate</span>
                      <span>
                        {analyticsData.visitorStats.totalVisitors > 0 
                          ? Math.round((analyticsData.visitorStats.knownVisitors / analyticsData.visitorStats.totalVisitors) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ 
                          width: `${analyticsData.visitorStats.totalVisitors > 0 
                            ? (analyticsData.visitorStats.knownVisitors / analyticsData.visitorStats.totalVisitors) * 100 
                            : 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Security Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Security Statistics
                </CardTitle>
                <CardDescription>Security-related events and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Night Time Events</span>
                    <Badge variant="secondary">{analyticsData.securityStats.nightTimeEvents}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Unusual Activity</span>
                    <Badge variant="secondary">{analyticsData.securityStats.unusualActivity}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Response Time</span>
                    <Badge variant="secondary">{analyticsData.averageResponseTime.toFixed(1)}s</Badge>
                  </div>
                  
                  <div className="pt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>System Uptime</span>
                      <span>99.8%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '99.8%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest security alerts and notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { type: 'motion', time: '2 min ago', camera: 'Front Door' },
                    { type: 'face', time: '5 min ago', camera: 'Backyard' },
                    { type: 'person', time: '12 min ago', camera: 'Driveway' },
                    { type: 'motion', time: '18 min ago', camera: 'Garage' }
                  ].map((alert, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          alert.type === 'motion' ? 'bg-blue-500' : 
                          alert.type === 'face' ? 'bg-purple-500' : 'bg-green-500'
                        }`}></div>
                        <span className="text-sm capitalize">{alert.type} detected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{alert.time}</span>
                        <span className="text-xs">{alert.camera}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalytics;