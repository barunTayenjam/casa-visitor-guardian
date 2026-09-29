'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useSocketStore } from '@/stores/socket';
import { cn } from '@/lib/utils';

/**
 * ThreatBanner — the hero moment on the dashboard.
 *
 * ALL CLEAR: breathing green border pulse + "System active · latest Xm ago"
 * ALERT:     amber pulsing border, event summary, tap to jump to Events page.
 *            Dismissible until the next high-confidence event arrives.
 *
 * This is the Night Watchman speaking — calm authority, never frantic.
 */
export function ThreatBanner() {
  const { data } = useEvents(10);
  const connected = useSocketStore((s) => s.connected);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // Re-render every 30s so relative times and the 5-minute window stay honest
  const [, setTick] = useState(0);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // No data or disconnected: show nothing
  if (!connected || !data) return null;

  const events = data.events;
  const recentWindow = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();

  const recentHighConfidence = events.filter(
    (e) =>
      e.confidence >= 0.8 &&
      new Date(e.timestamp).getTime() > now - recentWindow,
  );

  const latestAlert = recentHighConfidence[0];
  const hasAlert = !!latestAlert && dismissedId !== latestAlert.id;
  const latestAgo = events[0] ? getRelativeTime(new Date(events[0].timestamp)) : '';

  const cameraName = latestAlert?.cameraName || latestAlert?.cameraId || 'a camera';
  const ago = latestAlert ? getRelativeTime(new Date(latestAlert.timestamp)) : '';
  const label = latestAlert?.labels?.[0]?.replace(/_/g, ' ') ?? 'motion detected';

  if (!hasAlert) {
    // ── ALL CLEAR ──────────────────────────────────────────────
    return (
      <div
        className={cn(
          'relative flex min-h-11 items-center gap-3 overflow-hidden border-b px-4 py-2.5',
          'border-emerald-500/15 bg-emerald-500/[0.04]',
          !reduceMotion && 'animate-pulse-soft',
        )}
      >
        {/* Breathing glow bar at left edge */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-[3px]',
            'bg-emerald-400',
            !reduceMotion && 'animate-breathing-glow',
          )}
        />
        <span className="ml-1 text-xs font-medium tracking-wide text-emerald-400">
          ALL CLEAR
        </span>
        <span className="text-xs text-muted-foreground">
          System active · {latestAgo ? `latest event ${latestAgo}` : 'all cameras monitoring'}
        </span>
      </div>
    );
  }

  // ── ALERT ──────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'relative flex min-h-11 items-center gap-3 overflow-hidden border-b px-4 py-2.5 pr-14',
        'border-amber-500/20 bg-amber-500/[0.06]',
        !reduceMotion && 'animate-alert-border',
      )}
    >
      <button
        type="button"
        onClick={() => router.push('/events')}
        aria-label={`${recentHighConfidence.length} high-confidence event${recentHighConfidence.length !== 1 ? 's' : ''} in the last 5 minutes. Click to view events.`}
        className="absolute inset-0 cursor-pointer transition-colors hover:bg-amber-500/[0.04]"
      >
        <span className="sr-only">View events</span>
      </button>
      {/* Pulsing amber left bar */}
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px]',
          'bg-amber-400',
          !reduceMotion && 'animate-breathing-alert',
        )}
      />
      <span className="pointer-events-none relative z-10 ml-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
        ALERT
      </span>
      <span className="pointer-events-none relative z-10 flex-1 truncate text-xs text-foreground/90">
        <span className="font-medium text-amber-300">
          {label}
        </span>{' '}
        on {cameraName}{' '}
        <span className="text-muted-foreground">· {ago}</span>
      </span>
      {recentHighConfidence.length > 1 && (
        <span className="pointer-events-none relative z-10 shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
          +{recentHighConfidence.length - 1}
        </span>
      )}
      <span className="pointer-events-none relative z-10 shrink-0 text-xs text-muted-foreground">View →</span>
      <button
        type="button"
        onClick={() => setDismissedId(latestAlert.id)}
        aria-label="Dismiss alert"
        className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
