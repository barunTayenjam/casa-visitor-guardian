import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  BarChart3,
  Activity,
  HardDrive,
  AlertTriangle,
  Calendar,
  ChevronLeft,
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
} from 'recharts';

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);

  // Mock data - in production, this would come from API
  const analyticsData = useMemo(() => ({
    eventsOverTime: [
      { date: 'Mon', events: 12, persons: 5, vehicles: 3 },
      { date: 'Tue', events: 19, persons: 8, vehicles: 4 },
      { date: 'Wed', events: 15, persons: 6, vehicles: 5 },
      { date: 'Thu', events: 25, persons: 12, vehicles: 7 },
      { date: 'Fri', events: 32, persons: 15, vehicles: 9 },
      { date: 'Sat', events: 28, persons: 10, vehicles: 8 },
      { date: 'Sun', events: 18, persons: 7, vehicles: 4 },
    ],
    detectionTypes: [
      { name: 'Person', value: 45, color: colors.detection.person },
      { name: 'Vehicle', value: 28, color: colors.detection.vehicle },
      { name: 'Package', value: 15, color: colors.detection.package },
      { name: 'Motion', value: 62, color: colors.detection.motion },
    ],
    cameraUptime: [
      { camera: 'Front Door', uptime: 98.5, events: 145 },
      { camera: 'Back Door', uptime: 99.2, events: 132 },
    ],
    hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      events: Math.floor(Math.random() * 30) + 5,
    })),
    storageStats: {
      used: 145,
      total: 500,
      events: 1250,
      retentionDays: 30,
    },
  }), []);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => setLoading(false), 1000);
  }, [timeRange]);

  const statCards = [
    {
      title: 'Total Events',
      value: analyticsData.storageStats.events.toLocaleString(),
      change: '+12%',
      icon: Activity,
      color: colors.status.info,
    },
    {
      title: 'Detections Today',
      value: '47',
      change: '+8%',
      icon: AlertTriangle,
      color: colors.status.warning,
    },
    {
      title: 'Storage Used',
      value: `${analyticsData.storageStats.used} GB`,
      change: `${((analyticsData.storageStats.used / analyticsData.storageStats.total) * 100).toFixed(1)}%`,
      icon: HardDrive,
      color: colors.status.success,
    },
    {
      title: 'Uptime',
      value: '99.2%',
      change: '+0.3%',
      icon: TrendingUp,
      color: colors.detection.person,
    },
  ];

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background.primary }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4" />
          <p className="text-white/60">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: colors.background.primary }}>
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.interactive.hover }}>
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-white">Analytics</h1>
              <p className="text-xs text-white/60 hidden sm:block">System insights and statistics</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    timeRange === range
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>

            <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5" onClick={() => navigate('/app')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div
              key={stat.title}
              className="p-4 rounded-lg border"
              style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                <span className="text-xs text-white/50">{stat.change}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/60 mt-1">{stat.title}</p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Events Over Time */}
          <div className="p-4 md:p-6 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <h3 className="text-base font-semibold text-white mb-4">Events Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.eventsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.background.secondary,
                    border: `1px solid ${colors.border.subtle}`,
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="events" stroke={colors.status.info} strokeWidth={2} name="Total Events" />
                <Line type="monotone" dataKey="persons" stroke={colors.detection.person} strokeWidth={2} name="Persons" />
                <Line type="monotone" dataKey="vehicles" stroke={colors.detection.vehicle} strokeWidth={2} name="Vehicles" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Detection Types */}
          <div className="p-4 md:p-6 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <h3 className="text-base font-semibold text-white mb-4">Detection Types</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.detectionTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
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

          {/* Hourly Activity */}
          <div className="p-4 md:p-6 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <h3 className="text-base font-semibold text-white mb-4">Hourly Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} interval={3} />
                <YAxis stroke="#94a3b8" fontSize={12} />
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

          {/* Camera Uptime */}
          <div className="p-4 md:p-6 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
            <h3 className="text-base font-semibold text-white mb-4">Camera Status</h3>
            <div className="space-y-4">
              {analyticsData.cameraUptime.map((camera) => (
                <div key={camera.camera} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{camera.camera}</span>
                    <span className="text-white/60">{camera.uptime}% uptime</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${camera.uptime}%`,
                        backgroundColor: colors.status.success,
                      }}
                    />
                  </div>
                  <p className="text-xs text-white/50">{camera.events} events recorded</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Storage Overview */}
        <div className="p-4 md:p-6 rounded-lg border" style={{ backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }}>
          <h3 className="text-base font-semibold text-white mb-4">Storage Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-3xl font-bold text-white">{analyticsData.storageStats.used} GB</p>
              <p className="text-sm text-white/60 mt-1">Used Space</p>
              <p className="text-xs text-white/40 mt-1">of {analyticsData.storageStats.total} GB total</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-3xl font-bold text-white">{analyticsData.storageStats.events.toLocaleString()}</p>
              <p className="text-sm text-white/60 mt-1">Total Events</p>
              <p className="text-xs text-white/40 mt-1">stored in database</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
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
