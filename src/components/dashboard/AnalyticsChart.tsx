
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Camera as CameraIcon } from 'lucide-react';
import { AnalyticsData } from '@/types/security';
import { useState } from 'react';

export const AnalyticsChart = () => {
  const [analytics] = useState<AnalyticsData>({
    eventsToday: 23,
    eventsThisWeek: 156,
    eventsThisMonth: 647,
    hourlyData: [
      { hour: 0, count: 2 },
      { hour: 1, count: 1 },
      { hour: 2, count: 0 },
      { hour: 3, count: 1 },
      { hour: 4, count: 0 },
      { hour: 5, count: 3 },
      { hour: 6, count: 8 },
      { hour: 7, count: 12 },
      { hour: 8, count: 15 },
      { hour: 9, count: 10 },
      { hour: 10, count: 8 },
      { hour: 11, count: 6 },
      { hour: 12, count: 9 },
      { hour: 13, count: 7 },
      { hour: 14, count: 11 },
      { hour: 15, count: 14 },
      { hour: 16, count: 18 },
      { hour: 17, count: 22 },
      { hour: 18, count: 19 },
      { hour: 19, count: 16 },
      { hour: 20, count: 12 },
      { hour: 21, count: 8 },
      { hour: 22, count: 5 },
      { hour: 23, count: 3 }
    ],
    cameraData: [
      { camera: 'Front Door', count: 89 },
      { camera: 'Driveway', count: 67 },
      { camera: 'Backyard', count: 34 },
      { camera: 'Garage', count: 12 }
    ],
    averageResponseTime: 2.3
  });

  const maxHourlyCount = Math.max(...analytics.hourlyData.map(d => d.count));
  const maxCameraCount = Math.max(...analytics.cameraData.map(d => d.count));

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
                <p className="text-2xl font-bold text-blue-500">{analytics.eventsToday}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">{analytics.eventsThisWeek}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{analytics.eventsThisMonth}</p>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
            </div>
            
            <div className="h-32">
              <div className="flex items-end justify-between h-full gap-1">
                {analytics.hourlyData.map((data) => (
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
                Avg response time: {analytics.averageResponseTime}s
              </span>
            </div>
            
            <div className="space-y-3">
              {analytics.cameraData.map((camera, index) => (
                <div key={camera.camera} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{camera.camera}</span>
                    <Badge variant="outline" className="text-xs">
                      {camera.count} events
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(camera.count / maxCameraCount) * 100}%`,
                        animationDelay: `${index * 0.1}s`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
