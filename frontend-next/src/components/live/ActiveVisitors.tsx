'use client';

import { useEffect, useState } from 'react';
import { eventService } from '@/services/api/eventService';
import { cn } from '@/lib/utils';

interface Visitor {
  id: string;
  name: string;
  lastSeen: Date;
  cameraName: string;
  isKnown: boolean;
  visitCount: number;
}

export const ActiveVisitors = () => {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        const response = await eventService.getEnhancedEventsList({
          event_type: 'person',
          pageSize: 50,
          sortBy: 'newest',
        });

        const visitorMap = new Map<string, Visitor>();

        response.events.forEach((event) => {
          if (event.persons_detected > 0 && event.known_faces_count > 0) {
            const faceDetections = event.face_detections || [];
            faceDetections.forEach((face) => {
              if (face.personName && face.isKnown) {
                const existing = visitorMap.get(face.personName);
                if (!existing || new Date(event.timestamp) > existing.lastSeen) {
                  visitorMap.set(face.personName, {
                    id: face.personName,
                    name: face.personName,
                    lastSeen: new Date(event.timestamp),
                    cameraName: event.cameraName || event.cameraId,
                    isKnown: face.isKnown,
                    visitCount: (existing?.visitCount || 0) + 1,
                  });
                }
              }
            });
          }
        });

        const sortedVisitors = Array.from(visitorMap.values())
          .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
          .slice(0, 5);

        setVisitors(sortedVisitors);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchVisitors();
    const interval = setInterval(fetchVisitors, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">
          Active Visitors
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {visitors.length} known
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
              <div className="flex-1">
                <div className="h-3 bg-white/[0.06] rounded w-20" />
                <div className="h-2 bg-white/[0.04] rounded w-16 mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : visitors.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-4">
          No known visitors detected
        </div>
      ) : (
        <div className="space-y-2">
          {visitors.map((visitor) => (
            <div
              key={visitor.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
            >
              {/* Avatar */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                visitor.isKnown
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-white/[0.06] text-muted-foreground border border-white/[0.10]',
              )}>
                {visitor.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-foreground/90 font-medium truncate">
                  {visitor.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{visitor.cameraName}</span>
                  <span>·</span>
                  <span>{formatTimeAgo(visitor.lastSeen)}</span>
                </div>
              </div>

              {/* Visit count */}
              <div className="text-xs text-muted-foreground tabular-nums">
                {visitor.visitCount}x
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
