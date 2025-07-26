import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Calendar,
  RefreshCw,
  Activity,
  Camera,
  Bell
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import apiService from '@/services/ApiService';

interface HourlyData {
  hour: number;
  count: number;
}

interface WeeklyData {
  totalEvents: number;
  dailyBreakdown: { date: string; count: number }[];
}

interface MonthlyData {
  totalEvents: number;
  weeklyBreakdown: { week: string; count: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const TabletAnalytics = () => {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [hourly, weekly, monthly] = await Promise.all([
        apiService.getHourlyAnalytics(),
        apiService.getWeeklyAnalytics(),
        apiService.getMonthlyAnalytics()
      ]);
      
      setHourlyData(hourly);
      setWeeklyData(weekly);
      setMonthlyData(monthly);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  // Transform hourly data for better display
  const formattedHourlyData = hourlyData.map(item => ({
    ...item,
    hourLabel: `${item.hour.toString().padStart(2, '0')}:00`
  }));

  // Calculate peak hours
  const peakHour = hourlyData.reduce((max, current) => 
    current.count > max.count ? current : max, 
    { hour: 0, count: 0 }
  );

  // Calculate daily averages
  const dailyAverage = weeklyData ? 
    Math.round(weeklyData.totalEvents / weeklyData.dailyBreakdown.length) : 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-12 text-center max-w-md">
          <BarChart3 className="h-16 w-16 text-muted-foreground animate-pulse mx-auto mb-6" />
          <h3 className="text-2xl font-medium mb-4">Loading Analytics...</h3>
          <p className="text-lg text-muted-foreground">
            Please wait while we gather analytics data.
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
          <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
          <p className="text-lg text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button 
          onClick={loadAnalytics} 
          disabled={loading}
          size="lg"
          className="h-12 px-6"
        >
          <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Events (Week)</p>
              <p className="text-3xl font-bold">{weeklyData?.totalEvents || 0}</p>
            </div>
            <Bell className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Daily Average</p>
              <p className="text-3xl font-bold">{dailyAverage}</p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Peak Hour</p>
              <p className="text-3xl font-bold">
                {peakHour.hour.toString().padStart(2, '0')}:00
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Peak Activity</p>
              <p className="text-3xl font-bold">{peakHour.count}</p>
              <p className="text-sm text-muted-foreground">events/hour</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-6 w-6" />
              Hourly Activity Pattern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedHourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hourLabel" 
                    fontSize={12}
                    interval={1}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value) => [`${value} events`, 'Count']}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#8884d8" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Weekly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {weeklyData && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData.dailyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={12}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      formatter={(value) => [`${value} events`, 'Count']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#82ca9d" 
                      strokeWidth={3}
                      dot={{ fill: '#82ca9d', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Monthly Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="h-80">
                {monthlyData && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData.weeklyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="week" 
                        fontSize={12}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        formatter={(value) => [`${value} events`, 'Count']}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="#ffc658" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-6 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Monthly Events</p>
                <p className="text-4xl font-bold text-primary">
                  {monthlyData?.totalEvents || 0}
                </p>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">Weekly Breakdown</h4>
                {monthlyData?.weeklyBreakdown.map((week, index) => (
                  <div key={week.week} className="flex items-center justify-between p-3 border rounded">
                    <span className="text-sm font-medium">{week.week}</span>
                    <Badge variant="secondary">{week.count} events</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activity Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium">Most Active Hour</p>
                <p className="text-sm text-muted-foreground">
                  {peakHour.hour.toString().padStart(2, '0')}:00 with {peakHour.count} events
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="font-medium">Weekly Average</p>
                <p className="text-sm text-muted-foreground">
                  {dailyAverage} events per day
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div>
                <p className="font-medium">Total This Month</p>
                <p className="text-sm text-muted-foreground">
                  {monthlyData?.totalEvents || 0} motion events detected
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Morning Activity (6-12)</span>
                  <span className="text-sm text-muted-foreground">
                    {hourlyData.filter(h => h.hour >= 6 && h.hour < 12).reduce((sum, h) => sum + h.count, 0)} events
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ 
                      width: `${(hourlyData.filter(h => h.hour >= 6 && h.hour < 12).reduce((sum, h) => sum + h.count, 0) / hourlyData.reduce((sum, h) => sum + h.count, 1)) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Afternoon Activity (12-18)</span>
                  <span className="text-sm text-muted-foreground">
                    {hourlyData.filter(h => h.hour >= 12 && h.hour < 18).reduce((sum, h) => sum + h.count, 0)} events
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full" 
                    style={{ 
                      width: `${(hourlyData.filter(h => h.hour >= 12 && h.hour < 18).reduce((sum, h) => sum + h.count, 0) / hourlyData.reduce((sum, h) => sum + h.count, 1)) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Evening Activity (18-24)</span>
                  <span className="text-sm text-muted-foreground">
                    {hourlyData.filter(h => h.hour >= 18 && h.hour < 24).reduce((sum, h) => sum + h.count, 0)} events
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full" 
                    style={{ 
                      width: `${(hourlyData.filter(h => h.hour >= 18 && h.hour < 24).reduce((sum, h) => sum + h.count, 0) / hourlyData.reduce((sum, h) => sum + h.count, 1)) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Night Activity (0-6)</span>
                  <span className="text-sm text-muted-foreground">
                    {hourlyData.filter(h => h.hour >= 0 && h.hour < 6).reduce((sum, h) => sum + h.count, 0)} events
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ 
                      width: `${(hourlyData.filter(h => h.hour >= 0 && h.hour < 6).reduce((sum, h) => sum + h.count, 0) / hourlyData.reduce((sum, h) => sum + h.count, 1)) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TabletAnalytics;