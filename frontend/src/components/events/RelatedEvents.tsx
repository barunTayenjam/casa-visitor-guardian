import React from 'react';
import { MotionEvent } from '@/types/security';
import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const getLabelColor = (label: string): string => {
  const colorMap: Record<string, string> = {
    person: '22c55e', vehicle: '3b82f6', face: '8b5cf6', package: '06b6d4', motion: 'f59e0b',
  };
  return colorMap[label] || colorMap.motion;
};

interface RelatedEventsProps {
  currentEvent: MotionEvent;
  events: MotionEvent[];
  maxEvents?: number;
  onEventSelect?: (eventId: string) => void;
}

export const RelatedEvents: React.FC<RelatedEventsProps> = ({ currentEvent, events, maxEvents = 6, onEventSelect }) => {
  const findRelatedEvents = React.useMemo(() => {
    const related = events.filter(event => {
      if (event.id === currentEvent.id) return false;
      const timeDiff = Math.abs(event.timestamp.getTime() - currentEvent.timestamp.getTime());
      const sameCamera = event.cameraId === currentEvent.cameraId;
      const withinHour = timeDiff < 60 * 60 * 1000;
      const hasSameLabel = event.labels && currentEvent.labels && event.labels.some(l => currentEvent.labels?.includes(l));
      return (sameCamera && withinHour) || hasSameLabel;
    });
    return related.sort((a, b) => Math.abs(a.timestamp.getTime() - currentEvent.timestamp.getTime()) - Math.abs(b.timestamp.getTime() - currentEvent.timestamp.getTime())).slice(0, maxEvents);
  }, [currentEvent, events, maxEvents]);

  if (findRelatedEvents.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-3">
          <Link2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">No related events found</p>
      </div>
    );
  }

  const getRelationLabel = (event: MotionEvent): string => {
    const timeDiff = Math.abs(event.timestamp.getTime() - currentEvent.timestamp.getTime());
    const minutes = Math.floor(timeDiff / (1000 * 60));
    if (event.cameraId === currentEvent.cameraId) {
      if (minutes < 5) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      return 'Same camera';
    }
    const hasSameLabel = event.labels && currentEvent.labels && event.labels.some(l => currentEvent.labels?.includes(l));
    return hasSameLabel ? `Similar: ${event.labels?.[0]}` : 'Related';
  };

  return (
    <div>
      <div className="px-5 py-4 hairline-bottom">
        <h3 className="text-xs font-medium text-foreground/70 uppercase tracking-[0.08em] flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5" /> Related Events
        </h3>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {findRelatedEvents.map((event, index) => (
          <div
            key={event.id}
            className="p-[1px] rounded-[1.25rem] bg-white/[0.06] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer hover:bg-white/[0.06] opacity-0"
            style={{ animation: `slide-up-reveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 60}ms forwards` }}
            onClick={() => onEventSelect?.(event.id)}
          >
            <div className="rounded-[calc(1.25rem-1px)] bg-black/40">
              <div className="relative aspect-video bg-black rounded-t-[calc(1.25rem-1px)] overflow-hidden">
                {event.imageUrl ? (
                  <ProgressiveImage src={event.imageUrl} alt={`Related event`} className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><p className="text-[10px] text-white/60">No image</p></div>
                )}
                <div className="absolute top-1.5 left-1.5">
                  <Badge variant="glass" className="text-[8px] px-1.5 py-0.5 bg-blue-500/60 text-white border-none">{getRelationLabel(event)}</Badge>
                </div>
                {event.labels && event.labels.length > 0 && (
                  <div className="absolute top-1.5 right-1.5">
                    <Badge variant="glass" className="text-[8px] px-1.5 py-0.5 text-white" style={{ backgroundColor: `${getLabelColor(event.labels[0])}80` }}>{event.labels[0]}</Badge>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-foreground truncate">{event.cameraName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{format(event.timestamp, 'HH:mm')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
