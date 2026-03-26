import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  BarChart3,
  Activity,
  HardDrive,
  AlertTriangle,
  ChevronLeft,
  Users,
  Car,
  Package,
  Clock,
  Calendar,
} from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useCameras } from '@/contexts/CameraContext';
import { useToast } from '@/hooks/use-toast';

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);

  const [analyticsData, setAnalyticsData] = useState({
    eventsOverTime: [] as any[],
    detectionTypes: [] as any[],
    cameraUptime: [] as any[],
    hourlyActivity: [] as any[],
    storageStats: {
      used: 0,
      total: 500,
      events: 0,
      retentionDays: 30,
    },
    totalEvents: 0,
    detectionsToday: 0,
    systemUptime: '99.2%',
  });

  const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

  // Fetch analytics data from backend
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        // Fetch hourly analytics
        const hourlyRes = await fetch('/api/analytics/hourly');
        const hourlyData = await hourlyRes.json();

        // Fetch events for time range
        const now = new Date();
        let daysBack = 7;
        if (timeRange === '30d') daysBack = 30;
        if (timeRange === '90d') daysBack = 90;

        const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
        const eventsRes = await fetch(
          `/api/events/list-enhanced?page=1&pageSize=1000&startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`
        );
        const eventsData = await eventsRes.json();

        // Process events data
        const events = eventsData.events || [];
        const eventsByDay = new Map<string, { events: number; persons: number; vehicles: number; packages: number }>();

        // Initialize with all days in range
        for (let i = daysBack - 1; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateKey = date.toLocaleDateString('en-US', { weekday: 'short' });
          eventsByDay.set(dateKey, { events: 0, persons: 0, vehicles: 0, packages: 0 });
        }

        // Count events by type and day
        events.forEach((event: any) => {
          const eventDate = new Date(event.timestamp);
          const dateKey = eventDate.toLocaleDateString('en-US', { weekday: 'short' });
          const current = eventsByDay.get(dateKey) || { events: 0, persons: 0, vehicles: 0, packages: 0 };

          current.events++;
          if (event.persons_detected > 0) current.persons += event.persons_detected;
          if (event.object_detections) {
            const objects = Array.isArray(event.object_detections) ? event.object_detections : [];
            objects.forEach((obj: any) => {
              if (obj.class === 'car' || obj.class === 'vehicle') current.vehicles++;
              if (obj.class === 'package') current.packages++;
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
        events.forEach((event: any) => {
          if (event.persons_detected > 0) detectionCounts.person += event.persons_detected;
          if (event.object_detections) {
            const objects = Array.isArray(event.object_detections) ? event.object_detections : [];
            objects.forEach((obj: any) => {
              if (obj.class === 'car' || obj.class === 'vehicle') detectionCounts.vehicle++;
              if (obj.class === 'package') detectionCounts.package++;
            });
          }
          detectionCounts.motion++;
        });

        const detectionTypes = [
          { name: 'Person', value: detectionCounts.person, color: colors.detection.person, icon: Users },
          { name: 'Vehicle', value: detectionCounts.vehicle, color: colors.detection.vehicle, icon: Car },
          { name: 'Package', value: detectionCounts.package, color: colors.detection.package, icon: Package },
          { name: 'Motion', value: detectionCounts.motion, color: colors.detection.motion, icon: Activity },
        ].filter(d => d.value > 0);

        // Camera uptime
        const cameraUptime = cameras.map(cam => ({
          camera: cam.name,
          uptime: cam.status === 'online' ? 99.2 : 0,
          events: events.filter((e: any) => e.camera_id === cam.id).length,
          status: cam.status,
        }));

        // Hourly activity from backend
        const hourlyActivity = (hourlyData.hourlyData || []).map((h: any) => ({
          hour: `${h.hour}:00`,
          events: h.count,
        }));

        // Calculate storage stats (estimate based on events)
        const avgEventSize = 0.5; // MB per event
        const totalEvents = events.length;
        const usedGB = Math.round((totalEvents * avgEventSize) / 1024);

        // Count today's detections
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const detectionsToday = events.filter((e: any) => new Date(e.timestamp) >= today).length;

        setAnalyticsData({
          eventsOverTime,
          detectionTypes,
          cameraUptime,
          hourlyActivity,
          storageStats: {
            used: usedGB,
            total: 500,
            events: totalEvents,
            retentionDays: 30,
          },
          totalEvents,
          detectionsToday,
          systemUptime: '99.2%',
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

  const StatCard = ({
    title,
    value,
    change,
    icon: Icon,
    color,
  }: {
    title: string;
    value: string | number;
    change: string;
    icon: any;
    color: string;
  }) => (
    <div className="p-5 rounded-xl border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-5 w-5" style={{ color: color }} />
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            change.startsWith('+') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          )}
        >
          {change}
        </span>
      </div>
      <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs text-white/50 mt-1">{title}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background.primary }}>
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: colors.background.primary }}>
      <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center gap-4 md:gap-6">
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5" onClick={() => navigate('/app/streams')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
              <BarChart3 className="h-5 w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Analytics</h1>
              <p className="text-xs text-white/50 hidden sm:block">System insights and statistics</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 border border-white/10" role="group" aria-label="Time range selection">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-medium transition-all',
                  timeRange === range ? 'bg-white/10 text-white shadow' : 'text-white/60 hover:text-white'
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

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Events"
            value={analyticsData.totalEvents}
            change="+12%"
            icon={Activity}
            color={colors.status.info}
          />
          <StatCard
            title="Detections Today"
            value={analyticsData.detectionsToday}
            change="+8%"
            icon={AlertTriangle}
            color={colors.status.warning}
          />
          <StatCard
            title="Storage Used"
            value={`${analyticsData.storageStats.used} GB`}
            change={`${((analyticsData.storageStats.used / analyticsData.storageStats.total) * 100).toFixed(1)}%`}
            icon={HardDrive}
            color={colors.status.success}
          />
          <StatCard
            title="System Uptime"
            value={analyticsData.systemUptime}
            change="+0.3%"
            icon={TrendingUp}
            color={colors.detection.person}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Events Over Time</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.status.info }} />
                  <span className="text-xs text-white/50">Events</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.detection.person }} />
                  <span className="text-xs text-white/50">Persons</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.detection.vehicle }} />
                  <span className="text-xs text-white/50">Vehicles</span>
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
                    <stop offset="5%" stopColor={colors.detection.person} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors.detection.person} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.detection.vehicle} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors.detection.vehicle} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
                <Area type="monotone" dataKey="persons" stroke={colors.detection.person} fillOpacity={1} fill="url(#colorPersons)" strokeWidth={2} />
                <Area type="monotone" dataKey="vehicles" stroke={colors.detection.vehicle} fillOpacity={1} fill="url(#colorVehicles)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="p-5 rounded-xl border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <h3 className="text-base font-semibold text-white mb-4">Detection Types</h3>
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

          <div className="p-5 rounded-xl border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Hourly Activity</h3>
              <div className="flex items-center gap-1 text-xs text-white/50">
                <Clock className="h-3 w-3" />
                Last 24 hours
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analyticsData.hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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

          <div className="p-5 rounded-xl border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Camera Status</h3>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Online
              </div>
            </div>
            <div className="space-y-4">
              {analyticsData.cameraUptime.map((camera) => (
                <div key={camera.camera} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${camera.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium text-white">{camera.camera}</span>
                    </div>
                    <span className="text-xs text-white/50">{camera.uptime}% uptime</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${camera.uptime}%`,
                        backgroundColor: colors.status.success,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">{camera.events} events recorded</span>
                    <span
                      className={cn('font-medium', camera.status === 'online' ? 'text-green-400' : 'text-red-400')}
                    >
                      {camera.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Storage Overview</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-6 bg-white/5 rounded-xl">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
                <HardDrive className="h-6 w-6" style={{ color: colors.status.info }} />
              </div>
              <p className="text-3xl font-bold text-white">{analyticsData.storageStats.used} GB</p>
              <p className="text-sm text-white/60 mt-1">Used Space</p>
              <p className="text-xs text-white/40 mt-1">of {analyticsData.storageStats.total} GB total</p>
            </div>
            <div className="text-center p-6 bg-white/5 rounded-xl">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${colors.status.warning}15` }}>
                <Activity className="h-6 w-6" style={{ color: colors.status.warning }} />
              </div>
              <p className="text-3xl font-bold text-white">{analyticsData.storageStats.events.toLocaleString()}</p>
              <p className="text-sm text-white/60 mt-1">Total Events</p>
              <p className="text-xs text-white/40 mt-1">stored in database</p>
            </div>
            <div className="text-center p-6 bg-white/5 rounded-xl">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${colors.detection.person}15` }}>
                <Calendar className="h-6 w-6" style={{ color: colors.detection.person }} />
              </div>
              <p className="text-3xl font-bold text-white">{analyticsData.storageStats.retentionDays}</p>
              <p className="text-sm text-white/60 mt-1">Retention Days</p>
              <p className="text-xs text-white/40 mt-1">auto-delete older events</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
