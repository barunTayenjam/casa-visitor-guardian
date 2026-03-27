import React from 'react';
import { Monitor, Activity, Wifi, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QualityMetrics {
  resolution: string;
  fps: number;
  bandwidth: number;
  latency: number;
}

interface QualitySectionProps {
  metrics: QualityMetrics;
  className?: string;
}

const getFpsStatus = (fps: number): 'good' | 'warning' | 'critical' => {
  if (fps >= 20) return 'good';
  if (fps >= 10) return 'warning';
  return 'critical';
};

const getBandwidthStatus = (bandwidth: number): 'good' | 'warning' | 'critical' => {
  if (bandwidth >= 1000) return 'good';
  if (bandwidth >= 500) return 'warning';
  return 'critical';
};

const getLatencyStatus = (latency: number): 'good' | 'warning' | 'critical' => {
  if (latency <= 100) return 'good';
  if (latency <= 500) return 'warning';
  return 'critical';
};

const statusColors = {
  good: 'text-green-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
};

interface MetricItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
}

const MetricItem: React.FC<MetricItemProps> = ({ icon: Icon, label, value, status }) => (
  <div className="flex items-center gap-1.5" role="group" aria-label={`${label}: ${value}`}>
    <Icon className={cn('h-3.5 w-3.5', statusColors[status])} />
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={cn('text-xs font-mono font-medium', statusColors[status])}>{value}</span>
  </div>
);

export const QualitySection: React.FC<QualitySectionProps> = ({ metrics, className }) => {
  const fpsStatus = getFpsStatus(metrics.fps);
  const bandwidthStatus = getBandwidthStatus(metrics.bandwidth);
  const latencyStatus = getLatencyStatus(metrics.latency);

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-3 py-2 rounded-md bg-muted/50',
        className
      )}
      role="status"
      aria-label="Stream quality metrics"
    >
      <MetricItem
        icon={Monitor}
        label="Res"
        value={metrics.resolution}
        status="good"
      />
      <MetricItem
        icon={Activity}
        label="FPS"
        value={`${metrics.fps}`}
        status={fpsStatus}
      />
      <MetricItem
        icon={Wifi}
        label="BW"
        value={`${metrics.bandwidth} Kbps`}
        status={bandwidthStatus}
      />
      <MetricItem
        icon={Clock}
        label="Lat"
        value={`${metrics.latency}ms`}
        status={latencyStatus}
      />
    </div>
  );
};
