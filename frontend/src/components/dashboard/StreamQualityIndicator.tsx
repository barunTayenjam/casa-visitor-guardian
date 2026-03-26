import React from 'react';
import { Monitor, Activity, Wifi, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StreamQualityMetrics {
  resolution: string;
  fps: number;
  bandwidth: number; // Kbps
  latency: number; // ms
}

interface StreamQualityIndicatorProps {
  metrics: StreamQualityMetrics;
  className?: string;
}

interface QualityBadgeProps {
  icon: React.ElementType;
  value: string;
  status?: 'good' | 'warning' | 'critical';
}

const QualityBadge: React.FC<QualityBadgeProps> = ({ icon: Icon, value, status = 'good' }) => {
  const statusStyles = {
    good: 'text-white',
    warning: 'text-yellow-300',
    critical: 'text-red-300'
  };

  return (
    <div className={cn(
      "flex items-center gap-1 text-[10px] font-mono",
      statusStyles[status]
    )}>
      <Icon className="h-3 w-3" />
      <span>{value}</span>
    </div>
  );
};

export const StreamQualityIndicator: React.FC<StreamQualityIndicatorProps> = ({
  metrics,
  className
}) => {
  // Determine quality status for each metric
  const fpsStatus = metrics.fps >= 20 ? 'good' : metrics.fps >= 10 ? 'warning' : 'critical';
  const bandwidthStatus = metrics.bandwidth >= 1000 ? 'good' : metrics.bandwidth >= 500 ? 'warning' : 'critical';
  const latencyStatus = metrics.latency <= 100 ? 'good' : metrics.latency <= 500 ? 'warning' : 'critical';

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm border border-white/10",
        className
      )}
      role="status"
      aria-label="Stream quality metrics"
    >
      <QualityBadge
        icon={Monitor}
        value={metrics.resolution}
        status="good"
      />
      <QualityBadge
        icon={Activity}
        value={`${metrics.fps} FPS`}
        status={fpsStatus}
      />
      <QualityBadge
        icon={Wifi}
        value={`${metrics.bandwidth} Kbps`}
        status={bandwidthStatus}
      />
      <QualityBadge
        icon={Clock}
        value={`${metrics.latency}ms`}
        status={latencyStatus}
      />
    </div>
  );
};

/**
 * Calculate if quality is poor overall
 */
export function isPoorQuality(metrics: StreamQualityMetrics): boolean {
  return (
    metrics.fps < 10 ||
    metrics.bandwidth < 500 ||
    metrics.latency > 2000
  );
}

/**
 * Get quality warning message based on metrics
 */
export function getQualityWarning(metrics: StreamQualityMetrics): string | null {
  if (metrics.fps < 10) {
    return "Low frame rate detected. Consider reducing resolution.";
  }
  if (metrics.bandwidth < 500) {
    return "Low bandwidth. Check your network connection.";
  }
  if (metrics.latency > 2000) {
    return "High latency. Camera may be far from router.";
  }
  return null;
}
