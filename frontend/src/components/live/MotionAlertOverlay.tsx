import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MotionAlertProps {
  hasMotion: boolean;
  confidence?: number;
  objectCount?: number;
  autoHide?: boolean;
  className?: string;
}

export const MotionAlertOverlay: React.FC<MotionAlertProps> = ({
  hasMotion,
  confidence = 0,
  objectCount = 0,
  autoHide = true,
  className,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasMotion) {
      setVisible(true);
      if (autoHide) {
        const timer = setTimeout(() => {
          setVisible(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [hasMotion, autoHide]);

  if (!visible || confidence < 5) return null;

  return (
    <div className={cn(
      "absolute top-3 right-3 animate-pulse z-20",
      className
    )}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/95 backdrop-blur-sm border border-red-400 shadow-lg">
        <Activity className="h-4 w-4 text-white animate-pulse" />
        <span className="text-xs font-semibold text-white">
          Motion Detected
        </span>
        <span className="text-[10px] font-mono text-white/90 bg-red-600/50 px-1.5 py-0.5 rounded">
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
