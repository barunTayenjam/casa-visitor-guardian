import React from 'react';
import { MotionEvent } from '@/types/security';
import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { colors } from '@/styles/design-tokens';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RelatedEventsProps {
  currentEvent: MotionEvent;
  events: MotionEvent[];
  maxEvents?: number;
  onEventSelect?: (eventId: string) => void;
}

export const RelatedEvents: React.FC<RelatedEventsProps> = ({
  currentEvent,
  events,
  maxEvents = 6,
  onEventSelect,
}) => {
  const findRelatedEvents = React.useMemo(() => {
    const related = events.filter(event => {
      if (event.id === currentEvent.id) return false;

      // Same camera within 1 hour
      const timeDiff = Math.abs(
        event.timestamp.getTime() - currentEvent.timestamp.getTime()
      );
      const sameCamera = event.cameraId === currentEvent.cameraId;
      const withinHour = timeDiff < 60 * 60 * 1000;

      // Same detection type
      const hasSameLabel =
        event.labels &&
        currentEvent.labels &&
        event.labels.some(l => currentEvent.labels?.includes(l));

      return (sameCamera && withinHour) || hasSameLabel;
    });

    // Sort by recency and similarity
    return related
      .sort((a, b) => {
        const aTime = Math.abs(a.timestamp.getTime() - currentEvent.timestamp.getTime());
        const bTime = Math.abs(b.timestamp.getTime() - currentEvent.timestamp.getTime());
        return aTime - bTime;
      })
      .slice(0, maxEvents);
  }, [currentEvent, events, maxEvents]);

  if (findRelatedEvents.length === 0) {
    return (
      <div
        className="p-6 text-center"
        style={{ backgroundColor: colors.background.tertiary }}
      >
        <Link2 className="h-8 w-8 mx-auto mb-2 text-white/30" />
        <p className="text-sm text-white/50">No related events found</p>
      </div>
    );
  }

  const getRelationLabel = (event: MotionEvent): string => {
    const timeDiff = Math.abs(
      event.timestamp.getTime() - currentEvent.timestamp.getTime()
    );
    const minutes = Math.floor(timeDiff / (1000 * 60));

    if (event.cameraId === currentEvent.cameraId) {
      if (minutes < 5) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      return `Same camera`;
    }

    const hasSameLabel =
      event.labels &&
      currentEvent.labels &&
      event.labels.some(l => currentEvent.labels?.includes(l));

    if (hasSameLabel) {
      return `Similar: ${event.labels?.[0]}`;
    }

    return 'Related';
  };

  return (
    <div>
      <div className="px-6 py-4 border-b" style={{ borderColor: colors.border.subtle }}>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Related Events
        </h3>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {findRelatedEvents.map(event => (
          <div
            key={event.id}
            className="relative rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105"
            style={{ backgroundColor: colors.background.tertiary }}
            onClick={() => onEventSelect?.(event.id)}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-black">
              {event.imageUrl ? (
                <img
                  src={event.imageUrl}
                  alt={event.cameraName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-xs text-white/30">No image</p>
                </div>
              )}

              {/* Relation Badge */}
              <div className="absolute top-2 left-2">
                <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-500/80 text-white border-none">
                  {getRelationLabel(event)}
                </Badge>
              </div>

              {/* Detection Type Badge */}
              {event.labels && event.labels.length > 0 && (
                <div className="absolute top-2 right-2">
                  <Badge
                    className="text-[10px] px-1.5 py-0.5"
                    style={{
                      backgroundColor: `${colors.detection[event.labels[0] as keyof typeof colors.detection] || colors.detection.motion}80`,
                      color: 'white',
                    }}
                  >
                    {event.labels[0]}
                  </Badge>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="p-2">
              <p className="text-xs font-medium text-white truncate">
                {event.cameraName}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">
                {format(event.timestamp, 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
