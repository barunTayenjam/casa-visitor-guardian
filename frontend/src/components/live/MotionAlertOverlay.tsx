import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Info } from 'lucide-react';
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
}

const SEVERITY_STYLES = {
  critical: {
    container: 'bg-red-500/95 border-red-400 shadow-red-500/50',
    icon: 'text-white',
    pulse: 'animate-pulse',
    autoHideDelay: 5000  // Critical alerts stay visible longer
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
}) => {
  const [visible, setVisible] = useState(false);
  const styles = SEVERITY_STYLES[severity];
  const Icon = SEVERITY_ICONS[severity];
  const label = SEVERITY_LABELS[severity];

  useEffect(() => {
    if (hasMotion) {
      setVisible(true);
      if (autoHide) {
        const timer = setTimeout(() => {
          setVisible(false);
        }, styles.autoHideDelay);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [hasMotion, autoHide, styles.autoHideDelay]);

  if (!visible || confidence < 5) return null;

  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-20",
        styles.pulse,
        className
      )}
      role="alert"
      aria-live="polite"
      aria-label={`${label} - ${objectType} detected with ${Math.round(confidence)}% confidence`}
    >
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-sm border shadow-lg",
        styles.container
      )}>
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
    </div>
  );
};
