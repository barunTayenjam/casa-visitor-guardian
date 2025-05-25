
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Camera as CameraIcon, AlertCircle } from 'lucide-react';
import { AnalyticsData, MotionEvent as RawMotionEvent } from '@/types/security';
import { useState, useEffect } from 'react';
import apiService from '@/services/ApiService'; // Corrected path

const placeholderHourlyData = () => Array(24).fill(null).map((_, i) => ({ hour: i, count: 0 }));
const requiresBackendIndicator = <span className="text-orange-500 ml-1 text-xs">*</span>;

export const AnalyticsChart = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    eventsToday: 0,
    eventsThisWeek: 0, // TODO: Backend API required for accurate weekly aggregates
    eventsThisMonth: 0, // TODO: Backend API required for accurate monthly aggregates
    hourlyData: placeholderHourlyData(),
    cameraData: [],
    averageResponseTime: 2.3, // TODO: Define and implement backend API for averageResponseTime
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawEvents, setRawEvents] = useState<RawMotionEvent[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedEvents = await apiService.getMotionEvents(1000); // Fetch last 1000 events
        setRawEvents(fetchedEvents);
      } catch (err) {
        console.error("Failed to fetch motion events:", err);
        setError("Failed to load event data. Please try again later.");
        setRawEvents([]); // Ensure rawEvents is empty on error
      }
      // setIsLoading(false) will be handled in the processing useEffect
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    if (rawEvents.length > 0) {
      const today = new Date();
      const todayEventsCount = rawEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate.toDateString() === today.toDateString();
      }).length;

      const newHourlyData = placeholderHourlyData();
      rawEvents.forEach(event => {
        const hour = new Date(event.timestamp).getHours();
        if (hour >= 0 && hour < 24) { // Basic validation
          newHourlyData[hour].count++;
        }
      });

      const newCameraDataMap = new Map<string, number>();
      rawEvents.forEach(event => {
        const camName = event.cameraName || event.cameraId || 'Unknown Camera';
        newCameraDataMap.set(camName, (newCameraDataMap.get(camName) || 0) + 1);
      });
      const newCameraData = Array.from(newCameraDataMap.entries())
        .map(([camera, count]) => ({ camera, count }))
        .sort((a, b) => b.count - a.count); // Sort by count descending

      setAnalyticsData(prev => ({
        ...prev,
        eventsToday: todayEventsCount,
        hourlyData: newHourlyData,
        cameraData: newCameraData,
        // eventsThisWeek and eventsThisMonth remain as placeholders
        // averageResponseTime remains as a placeholder
      }));
    } else if (!isLoading && error === null) { // Only set if not loading and no prior error
       // If rawEvents is empty after fetch (and not due to an error), ensure data is zeroed out
       setAnalyticsData(prev => ({
        ...prev,
        eventsToday: 0,
        hourlyData: placeholderHourlyData(),
        cameraData: [],
      }));
    }
    // This effect should also set loading to false after processing
    if (isLoading) { // Check if it was loading before this effect ran
      setIsLoading(false);
    }
  }, [rawEvents, isLoading, error]); // Added isLoading and error to dependency array

  const maxHourlyCount = Math.max(1, ...analyticsData.hourlyData.map(d => d.count)); // Ensure not 0 to prevent division by zero
  const maxCameraCount = Math.max(1, ...analyticsData.cameraData.map(d => d.count)); // Ensure not 0

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Activity by Hour</CardTitle></CardHeader>
          <CardContent><p>Loading analytics data...</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Activity by Camera</CardTitle></CardHeader>
          <CardContent><p>Loading analytics data...</p></CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
          <CardContent className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-destructive" /> 
            {error}
          </CardContent>
        </Card>
         <Card>
          <CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
          <CardContent className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-destructive" /> 
            Unable to load camera analytics.
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const noEventData = rawEvents.length === 0 && !isLoading && !error;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Activity by Hour</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-500">{analyticsData.eventsToday}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">
                  {analyticsData.eventsThisWeek}
                  {analyticsData.eventsThisWeek === 0 && requiresBackendIndicator}
                </p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">
                  {analyticsData.eventsThisMonth}
                  {analyticsData.eventsThisMonth === 0 && requiresBackendIndicator}
                </p>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
            </div>
            
            {noEventData ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                No event data available for hourly chart.
              </div>
            ) : (
              <div className="h-32">
                <div className="flex items-end justify-between h-full gap-1">
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
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Activity by Camera</CardTitle>
            <CameraIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">
                Avg response time: {analyticsData.averageResponseTime}s
                {requiresBackendIndicator}
              </span>
            </div>
            
            {noEventData || analyticsData.cameraData.length === 0 ? (
               <div className="h-32 flex items-center justify-center text-muted-foreground">
                No event data available for camera chart.
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {analyticsData.cameraData.map((camera, index) => (
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
                          width: `${(camera.count / maxCameraCount) * 100}%`,
                          animationDelay: `${index * 0.05}s` // Reduced delay
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
