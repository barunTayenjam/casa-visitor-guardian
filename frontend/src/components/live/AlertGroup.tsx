import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertSeverity, classifyAlert } from '@/lib/severity';
import { MotionAlertOverlay } from './MotionAlertOverlay';

export interface MotionAlert {
  id: string;
  timestamp: Date;
  objectType: string;
  confidence: number;
  zone?: string;
  eventId?: string;
}

export interface AlertGroup {
  primaryAlert: MotionAlert;
  relatedAlerts: MotionAlert[];
  startTime: Date;
  endTime: Date;
  severity: AlertSeverity;
}

interface AlertGroupProps {
  group: AlertGroup;
  onSnooze?: (duration: number) => void;
  onDismiss?: () => void;
  onReview?: (eventId: string) => void;
}

const GROUPING_WINDOW = 30000; // 30 seconds

/**
 * Group rapid successive alerts together
 */
export function groupAlerts(alerts: MotionAlert[]): AlertGroup[] {
  if (alerts.length === 0) return [];

  const groups: AlertGroup[] = [];
  let currentGroup: MotionAlert[] = [alerts[0]];

  for (let i = 1; i < alerts.length; i++) {
    const alert = alerts[i];
    const firstInGroup = currentGroup[0];
    const timeDiff = alert.timestamp.getTime() - firstInGroup.timestamp.getTime();

    if (timeDiff <= GROUPING_WINDOW) {
      currentGroup.push(alert);
    } else {
      // Finalize current group
      groups.push(createGroupFromAlerts(currentGroup));
      // Start new group
      currentGroup = [alert];
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(createGroupFromAlerts(currentGroup));
  }

  return groups;
}

function createGroupFromAlerts(alerts: MotionAlert[]): AlertGroup {
  // Sort by confidence descending - highest confidence is primary
  const sorted = [...alerts].sort((a, b) => b.confidence - a.confidence);
  const primary = sorted[0];
  const related = sorted.slice(1);

  // Group severity = highest member severity
  const severities = sorted.map(a =>
    classifyAlert(a.objectType, a.confidence, a.zone)
  );
  const groupSeverity = determineGroupSeverity(severities);

  return {
    primaryAlert: primary,
    relatedAlerts: related,
    startTime: alerts[0].timestamp,
    endTime: alerts[alerts.length - 1].timestamp,
    severity: groupSeverity
  };
}

function determineGroupSeverity(severities: AlertSeverity[]): AlertSeverity {
  if (severities.includes(AlertSeverity.CRITICAL)) return AlertSeverity.CRITICAL;
  if (severities.includes(AlertSeverity.IMPORTANT)) return AlertSeverity.IMPORTANT;
  return AlertSeverity.INFORMATIONAL;
}

/**
 * Display grouped alerts with expand/collapse
 */
export const AlertGroupDisplay: React.FC<AlertGroupProps> = ({
  group,
  onSnooze,
  onDismiss,
  onReview
}) => {
  const [expanded, setExpanded] = useState(false);
  const totalCount = 1 + group.relatedAlerts.length;

  // Auto-expand if more than 2 alerts
  useEffect(() => {
    if (totalCount > 2) {
      setExpanded(true);
    }
  }, [totalCount]);

  const handleSnooze = (duration: number) => {
    onSnooze?.(duration);
  };

  const handleDismiss = () => {
    onDismiss?.();
  };

  const handleReview = (eventId: string) => {
    onReview?.(eventId);
  };

  return (
    <div
      className={cn(
        "absolute top-3 right-3 z-20 max-w-sm",
        expanded ? "w-auto" : "w-auto"
      )}
      role="alert"
      aria-live="polite"
    >
      <div className={cn(
        "rounded-lg backdrop-blur-sm border shadow-lg",
        group.severity === 'critical' && "bg-red-500/95 border-red-400",
        group.severity === 'important' && "bg-orange-500/95 border-orange-400",
        group.severity === 'info' && "bg-blue-500/95 border-blue-400"
      )}>
        {/* Primary alert */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            {totalCount > 1 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-white hover:bg-white/10 rounded px-1 transition-colors"
                aria-label={expanded ? "Collapse alert group" : "Expand alert group"}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span className="text-[10px] font-mono">{totalCount} events</span>
              </button>
            )}

            <MotionAlertOverlay
              hasMotion={true}
              confidence={group.primaryAlert.confidence}
              objectCount={totalCount}
              severity={group.severity}
              objectType={group.primaryAlert.objectType}
              autoHide={false}
              onSnooze={handleSnooze}
              onDismiss={handleDismiss}
              onReview={() => handleReview(group.primaryAlert.id)}
              eventId={group.primaryAlert.eventId}
            />
          </div>
        </div>

        {/* Related alerts */}
        {expanded && group.relatedAlerts.length > 0 && (
          <div className="border-t border-white/20 px-3 py-2 space-y-1">
            {group.relatedAlerts.map((alert, index) => {
              const severity = classifyAlert(alert.objectType, alert.confidence, alert.zone);
              const timeDiff = Math.round((alert.timestamp.getTime() - group.startTime.getTime()) / 1000);

              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between gap-2 text-[10px] text-white/80 hover:bg-white/5 rounded px-2 py-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white/60">+{timeDiff}s</span>
                    <span>{alert.objectType}</span>
                    <span className="text-white/60">{Math.round(alert.confidence)}%</span>
                  </div>
                  <button
                    onClick={() => handleReview(alert.id)}
                    className="opacity-0 hover:opacity-100 text-white/60 hover:text-white transition-opacity"
                    aria-label={`Review alert from ${alert.objectType}`}
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
