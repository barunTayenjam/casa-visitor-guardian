import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Activity,
  HardDrive,
  AlertTriangle,
  Users,
  Car,
  Package,
  Clock,
  Calendar,
} from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useCameras } from '@/contexts/CameraContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { PageLoading } from '@/components/ui/PageLoading';
import { systemService } from '@/services/api/systemService';
import { eventService } from '@/services/api/eventService';

interface AnalyticsEvent {
  id: string;
  timestamp: string;
  cameraId: string;
  persons_detected: number;
  object_detections?: { class?: string }[] | null;
}

interface HourlyDataPoint {
  hour: number;
  count: number;
}

interface ChartDataPoint {
  date: string;
  events: number;
  persons: number;
  vehicles: number;
  packages: number;
}

interface DetectionTypeData {
  name: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CameraUptimeData {
  camera: string;
  events: number;
  status: string;
}

interface HourlyActivityData {
  hour: string;
  events: number;
}

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);

  const [analyticsData, setAnalyticsData] = useState({
    eventsOverTime: [] as ChartDataPoint[],
    detectionTypes: [] as DetectionTypeData[],
    cameraUptime: [] as CameraUptimeData[],
    hourlyActivity: [] as HourlyActivityData[],
    storageStats: {
      used: 0,
      events: 0,
    },
    totalEvents: 0,
    detectionsToday: 0,
    detectionsYesterday: 0,
    todayChange: 0,
  });

  // Fetch analytics data from backend
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const hourlyData = await systemService.getHourlyAnalytics();

        const now = new Date();
        let daysBack = 7;
        if (timeRange === '30d') daysBack = 30;
        if (timeRange === '90d') daysBack = 90;

        const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
        const eventsResponse = await eventService.getEnhancedEventsList({
          page: 1,
          pageSize: 1000,
          start_date: startDate.toISOString(),
          end_date: now.toISOString(),
        });
        const events = eventsResponse.events || [];
        const eventsByDay = new Map<string, { events: number; persons: number; vehicles: number; packages: number }>();

        // Initialize with all days in range
        for (let i = daysBack - 1; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          eventsByDay.set(dateKey, { events: 0, persons: 0, vehicles: 0, packages: 0 });
        }

        // Count events by type and day
        events.forEach((event: AnalyticsEvent) => {
          const eventDate = new Date(event.timestamp);
          const dateKey = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const current = eventsByDay.get(dateKey) || { events: 0, persons: 0, vehicles: 0, packages: 0 };

          current.events++;
          if (event.persons_detected > 0) current.persons += event.persons_detected;
          if (event.object_detections) {
            const objects = Array.isArray(event.object_detections) ? event.object_detections : [];
            objects.forEach((obj) => {
              if (obj.class === 'package') current.packages++;
              if (obj.class === 'car' || obj.class === 'truck' || obj.class === 'motorcycle' ||
                  obj.class === 'bus' || obj.class === 'vehicle') {
                current.vehicles++;
              }
            });
          }

          eventsByDay.set(dateKey, current);
        });

        const eventsOverTime = Array.from(eventsByDay.entries()).map(([date, counts]) => ({
          date,
          events: counts.events,
          persons: counts.persons,
          vehicles: counts.vehicles,
          packages: counts.packages,
        }));

         // Count detection types
        const detectionCounts = { person: 0, vehicle: 0, package: 0, motion: 0 };
        events.forEach((event: AnalyticsEvent) => {
          if (event.persons_detected > 0) detectionCounts.person += event.persons_detected;
          if (event.object_detections) {
            const objects = Array.isArray(event.object_detections) ? event.object_detections : [];
            objects.forEach((obj) => {
              if (obj.class === 'car' || obj.class === 'vehicle') detectionCounts.vehicle++;
              if (obj.class === 'package') detectionCounts.package++;
            });
          }
          detectionCounts.motion++;
        });
        
        const detectionTypes = [
          { name: 'Person', value: detectionCounts.person, color: '#22c55e', icon: Users }, // person: green-500
          { name: 'Vehicle', value: detectionCounts.vehicle, color: '#3b82f6', icon: Car }, // vehicle: blue-500
          { name: 'Package', value: detectionCounts.package, color: '#06b6d4', icon: Package }, // package: cyan-500
          { name: 'Motion', value: detectionCounts.motion, color: '#f59e0b', icon: Activity }, // motion: amber-500
        ].filter(d => d.value > 0);

        // Camera uptime
        const cameraUptime = cameras.map(cam => ({
          camera: cam.name,
          events: events.filter((e: AnalyticsEvent) => e.cameraId === cam.id).length,
          status: cam.status,
        }));

        // Hourly activity from backend
        const hourlyActivity = (Array.isArray(hourlyData) ? hourlyData : []).map((h: HourlyDataPoint) => ({
          hour: `${h.hour}:00`,
          events: h.count,
        }));

        // Query real storage stats
        const totalEvents = events.length;
        let storageUsedBytes = 0;
        try {
          const storageStats = await systemService.getStorageStats();
          storageUsedBytes = storageStats.storageUsed || 0;
        } catch (e) {
          console.debug('Storage stats fetch failed', e);
        }

        const usedGB = Math.round(storageUsedBytes / (1024 * 1024 * 1024));

        // Count today's detections
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const detectionsToday = events.filter((e: AnalyticsEvent) => new Date(e.timestamp) >= today).length;

        // Count yesterday's detections for comparison
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const detectionsYesterday = events.filter((e: AnalyticsEvent) => {
          const eventDate = new Date(e.timestamp);
          return eventDate >= yesterday && eventDate < today;
        }).length;

        // Calculate change percentage
        const todayChange = detectionsYesterday > 0 
          ? Math.round(((detectionsToday - detectionsYesterday) / detectionsYesterday) * 100)
          : (detectionsToday > 0 ? 100 : 0);

        setAnalyticsData({
          eventsOverTime,
          detectionTypes,
          cameraUptime,
          hourlyActivity,
          storageStats: {
            used: usedGB,
            events: totalEvents,
          },
          totalEvents,
          detectionsToday,
          detectionsYesterday,
          todayChange,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast({
          title: 'Error',
          description: 'Failed to load analytics data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange, cameras, toast]);

  if (loading) {
    return (
      <div className="w-full min-h-[100dvh] bg-background">
        <PageLoading message="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] bg-background">
      <div className="px-5 pt-6 pb-2 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
              Analytics
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Insights & Statistics</h1>
          </div>
          <div className="bezel inline-flex" role="group" aria-label="Time range selection">
            <div className="bezel-inner flex items-center gap-0 p-1">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-4 py-2 rounded-[3px] text-xs font-medium transition-all',
                    timeRange === range ? 'bg-white/[0.06] text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                  aria-pressed={timeRange === range}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-28 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Events"
            value={analyticsData.totalEvents}
            icon={Activity}
            iconColor="text-blue-500"
          />
          <StatCard
            label="Detections Today"
            value={analyticsData.detectionsToday}
            icon={AlertTriangle}
            iconColor="text-amber-500"
            change={{ value: analyticsData.todayChange, label: 'vs yesterday' }}
          />
          <StatCard
            label="Cameras Online"
            value={cameras.filter(c => c.status === 'online').length}
            icon={BarChart3}
            iconColor="text-green-500"
          />
          <StatCard
            label="Storage Used"
            value={`${analyticsData.storageStats.used} GB`}
            icon={HardDrive}
            iconColor="text-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bezel">
            <div className="bezel-inner p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Events Over Time</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.status.info }} />
                    <span className="text-xs text-muted-foreground">Events</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                    <span className="text-xs text-muted-foreground">Persons</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                    <span className="text-xs text-muted-foreground">Vehicles</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={analyticsData.eventsOverTime}>
                  <defs>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.status.info} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={colors.status.info} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPersons" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border.subtle} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.background.secondary,
                      border: `1px solid ${colors.border.subtle}`,
                      borderRadius: '8px',
                    }}
                  />
                  <Area type="monotone" dataKey="events" stroke={colors.status.info} fillOpacity={1} fill="url(#colorEvents)" strokeWidth={2} />
                  <Area type="monotone" dataKey="persons" stroke="#22c55e" fillOpacity={1} fill="url(#colorPersons)" strokeWidth={2} />
                  <Area type="monotone" dataKey="vehicles" stroke="#3b82f6" fillOpacity={1} fill="url(#colorVehicles)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bezel">
            <div className="bezel-inner p-5">
              <h3 className="text-base font-semibold text-foreground mb-4">Detection Types</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analyticsData.detectionTypes}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.detectionTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.background.secondary,
                      border: `1px solid ${colors.border.subtle}`,
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bezel">
            <div className="bezel-inner p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Hourly Activity</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last 24 hours
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analyticsData.hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border.subtle} />
                  <XAxis dataKey="hour" stroke="#64748b" fontSize={12} interval={3} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.background.secondary,
                      border: `1px solid ${colors.border.subtle}`,
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="events" fill={colors.status.info} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bezel">
            <div className="bezel-inner p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Camera Status</h3>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {cameras.filter(c => c.status === 'online').length} online
                </div>
              </div>
              <div className="space-y-4">
                {analyticsData.cameraUptime.map((camera) => (
                  <div key={camera.camera} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${camera.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-sm font-medium text-foreground">{camera.camera}</span>
                      </div>
                      <span className={cn('text-xs font-medium', camera.status === 'online' ? 'text-green-400' : 'text-red-400')}>
                        {camera.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{camera.events} events recorded</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bezel">
          <div className="bezel-inner p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Storage Overview</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-6 bg-white/[0.06] rounded-[0.75rem]">
                <div className="w-12 h-12 rounded-[0.75rem] mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
                  <HardDrive className="h-6 w-6" style={{ color: colors.status.info }} />
                </div>
                <p className="text-3xl font-bold text-foreground">{analyticsData.storageStats.used} GB</p>
                <p className="text-sm text-muted-foreground mt-1">Used Space</p>
              </div>
              <div className="text-center p-6 bg-white/[0.06] rounded-[0.75rem]">
                <div className="w-12 h-12 rounded-[0.75rem] mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${colors.status.warning}15` }}>
                  <Activity className="h-6 w-6" style={{ color: colors.status.warning }} />
                </div>
                <p className="text-3xl font-bold text-foreground">{analyticsData.storageStats.events.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Events</p>
                <p className="text-xs text-muted-foreground mt-1">stored in database</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
