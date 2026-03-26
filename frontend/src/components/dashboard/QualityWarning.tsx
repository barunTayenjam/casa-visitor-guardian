import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StreamQualityMetrics, isPoorQuality, getQualityWarning } from './StreamQualityIndicator';

interface QualityWarningProps {
  metrics: StreamQualityMetrics;
  onDismiss?: () => void;
  className?: string;
}

export const QualityWarning: React.FC<QualityWarningProps> = ({
  metrics,
  onDismiss,
  className
}) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show warning if quality is poor and hasn't been dismissed this session
    if (isPoorQuality(metrics) && !dismissed) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [metrics, dismissed]);

  const warningMessage = getQualityWarning(metrics);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || !warningMessage) return null;

  return (
    <div
      className={cn(
        "absolute top-16 left-1/2 -translate-x-1/2 z-30 w-80",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-yellow-500/95 backdrop-blur-md border border-yellow-400 shadow-lg">
        <AlertTriangle className="h-5 w-5 text-yellow-950 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-950">
            Stream Quality Issue
          </p>
          <p className="text-xs text-yellow-900 mt-1">
            {warningMessage}
          </p>
          <p className="text-[10px] text-yellow-800 mt-2">
            Suggested fixes:
            {metrics.fps < 10 && (
              <li>Reduce resolution to improve frame rate</li>
            )}
            {metrics.bandwidth < 500 && (
              <li>Check WiFi signal or network connection</li>
            )}
            {metrics.latency > 2000 && (
              <li>Move camera closer to router</li>
            )}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-yellow-950 hover:text-yellow-800 transition-colors"
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
