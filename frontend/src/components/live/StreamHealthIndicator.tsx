import React from 'react';
import { Wifi, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamHealthIndicatorProps {
  fps: number;
  bandwidth: number;
  latency: number;
  viewerCount?: number;
  className?: string;
}

export const StreamHealthIndicator: React.FC<StreamHealthIndicatorProps> = ({
  fps,
  bandwidth,
  latency,
  viewerCount = 0,
  className,
}) => {
  const getHealthColor = () => {
    if (fps >= 3 && latency < 1000) return 'text-green-500';
    if (fps >= 2 && latency < 2000) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthLabel = () => {
    if (fps >= 3 && latency < 1000) return 'Excellent';
    if (fps >= 2 && latency < 2000) return 'Good';
    if (fps >= 1 && latency < 3000) return 'Fair';
    return 'Poor';
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-white/10",
      className
    )}>
      <Wifi className={cn("h-3 w-3", getHealthColor())} />
      <span className="text-[10px] font-mono text-white/80">
        {fps}fps | {Math.round(bandwidth / 1024)}KB/s
      </span>
      {viewerCount > 0 && (
        <>
          <span className="text-white/20">•</span>
          <span className="text-[10px] text-white/60 flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {viewerCount}
          </span>
        </>
      )}
    </div>
  );
};
