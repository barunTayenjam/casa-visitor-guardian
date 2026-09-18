import { useEffect, useState, useRef } from 'react';
import { eventService } from '@/services/api/eventService';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineEvent {
  id: string;
  timestamp: Date;
  cameraName: string;
  eventType: string;
  confidence: number;
  verified: boolean;
  tier?: string;
  imageUrl?: string;
}

export const VerificationTimeline = () => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await eventService.getEnhancedEventsList({
          pageSize: 20,
          sortBy: 'newest',
        });

        const timelineEvents = response.events.map((event) => ({
          id: event.id,
          timestamp: new Date(event.timestamp),
          cameraName: event.cameraName || event.cameraId,
          eventType: event.event_type || 'motion',
          confidence: event.confidence,
          verified: event.persons_detected > 0,
          tier: (event.metadata?.humanVerification as { tier?: string })?.tier,
          imageUrl: event.imageUrl,
        }));

        setEvents(timelineEvents);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 15000);
    return () => clearInterval(interval);
  }, []);

  const getTierLabel = (tier?: string) => {
    switch (tier) {
      case 'yolo_high': return 'YOLO';
      case 'face': return 'FACE';
      case 'pose': return 'POSE';
      case 'score_floor': return 'SCORE';
      default: return 'MOTION';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/[0.10]">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">
            Verification Timeline
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {events.length} events
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-16 h-3 bg-white/[0.06] rounded" />
                <div className="flex-1 h-3 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No events recorded
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 py-2.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className={cn(
                      'mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
                      event.verified ? 'bg-green-400' : 'bg-white/[0.06]',
                    )} />

                    {/* Time */}
                    <div className="text-xs text-muted-foreground tabular-nums w-16 flex-shrink-0">
                      {formatTime(event.timestamp)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground/90 truncate">
                          {event.cameraName}
                        </span>
                        <span className={cn(
                          'text-xs uppercase tracking-wider font-medium px-1.5 py-0.5 rounded',
                          event.verified
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-white/[0.06] text-muted-foreground',
                        )}>
                          {getTierLabel(event.tier)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {event.eventType}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {(event.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Verification badge */}
                    {event.verified && (
                      <div className="flex-shrink-0">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="w-3.5 h-3.5 text-green-400"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
