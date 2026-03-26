import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Info, Bell, BellOff, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertSeverity } from '@/lib/severity';

interface MotionAlertProps {
  hasMotion: boolean;
  confidence?: number;
  objectCount?: number;
  severity?: AlertSeverity;
  objectType?: string;
  autoHide?: boolean;
  className?: string;
  onSnooze?: (duration: number) => void;
  onDismiss?: () => void;
  onReview?: () => void;
  eventId?: string;
}

const SEVERITY_STYLES = {
  critical: {
    container: 'bg-red-500/95 border-red-400 shadow-red-500/50',
    icon: 'text-white',
    pulse: 'animate-pulse',
    autoHideDelay: 5000
  },
  important: {
    container: 'bg-orange-500/95 border-orange-400 shadow-orange-500/50',
    icon: 'text-white',
    pulse: '',
    autoHideDelay: 4000
  },
  info: {
    container: 'bg-blue-500/95 border-blue-400 shadow-blue-500/50',
    icon: 'text-white',
    pulse: '',
    autoHideDelay: 3000
  }
};

const SEVERITY_ICONS = {
  critical: Activity,
  important: AlertTriangle,
  info: Info
};

const SEVERITY_LABELS = {
  critical: 'Critical Alert',
  important: 'Motion Detected',
  info: 'Motion Detected'
};

export const MotionAlertOverlay: React.FC<MotionAlertProps> = ({
  hasMotion,
  confidence = 0,
  objectCount = 0,
  severity = AlertSeverity.INFORMATIONAL,
  objectType = 'unknown',
  autoHide = true,
  className,
  onSnooze,
  onDismiss,
  onReview,
  eventId
}) => {
  const [visible, setVisible] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const styles = SEVERITY_STYLES[severity];
  const Icon = SEVERITY_ICONS[severity];
  const label = SEVERITY_LABELS[severity];

  useEffect(() => {
    if (hasMotion) {
      setVisible(true);
      if (autoHide) {
        const timer = setTimeout(() => {
          setVisible(false);
          setShowActions(false);
        }, styles.autoHideDelay);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
      setShowActions(false);
    }
  }, [hasMotion, autoHide, styles.autoHideDelay]);

  const handleSnooze = (duration: number) => {
    onSnooze?.(duration);
    setVisible(false);
    setShowActions(false);
  };

  const handleDismiss = () => {
    onDismiss?.();
    setVisible(false);
    setShowActions(false);
  };

  const handleReview = () => {
    onReview?.();
    setVisible(false);
    setShowActions(false);
  };

  if (!visible || confidence < 5) return null;

  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-20 group",
        styles.pulse,
        className
      )}
      role="alert"
      aria-live="polite"
      aria-label={`${label} - ${objectType} detected with ${Math.round(confidence)}% confidence`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn(
        "flex flex-col gap-2 rounded-lg backdrop-blur-sm border shadow-lg transition-all",
        styles.container,
        showActions ? "p-3" : "px-3 py-2"
      )}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", styles.icon, severity === 'critical' && "animate-pulse")} />
          <span className="text-xs font-semibold text-white">
            {label}
          </span>
          <span className={cn(
            "text-[10px] font-mono text-white/90 px-1.5 py-0.5 rounded",
            severity === 'critical' ? 'bg-red-600/50' :
            severity === 'important' ? 'bg-orange-600/50' :
            'bg-blue-600/50'
          )}>
            {Math.round(confidence)}%
          </span>
          {objectCount > 0 && (
            <span className="text-[10px] text-white/80">
              {objectCount} {objectCount === 1 ? 'object' : 'objects'}
            </span>
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-1 pt-1 border-t border-white/20">
            <button
              onClick={() => handleSnooze(300000)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white hover:bg-white/10 rounded transition-colors"
              title="Snooze for 5 minutes"
              aria-label="Snooze alert for 5 minutes"
            >
              <BellOff className="h-3 w-3" />
              <span>5m</span>
            </button>
            <button
              onClick={() => handleSnooze(1800000)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white hover:bg-white/10 rounded transition-colors"
              title="Snooze for 30 minutes"
              aria-label="Snooze alert for 30 minutes"
            >
              <BellOff className="h-3 w-3" />
              <span>30m</span>
            </button>
            <button
              onClick={() => handleSnooze(7200000)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white hover:bg-white/10 rounded transition-colors"
              title="Snooze for 2 hours"
              aria-label="Snooze alert for 2 hours"
            >
              <BellOff className="h-3 w-3" />
              <span>2h</span>
            </button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={handleReview}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white hover:bg-white/10 rounded transition-colors"
              title="Review event"
              aria-label="Review this event"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Review</span>
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-white hover:bg-white/10 rounded transition-colors"
              title="Dismiss alert"
              aria-label="Dismiss this alert"
            >
              <BellOff className="h-3 w-3" />
              <span>Dismiss</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
