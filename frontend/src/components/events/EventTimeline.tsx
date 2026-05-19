import React, { useState, useRef, useEffect } from 'react';
import { MotionEvent } from '@/types/security';
import { colors } from '@/styles/design-tokens';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface EventTimelineProps {
  events: MotionEvent[];
  selectedEventId?: string;
  onEventSelect?: (eventId: string) => void;
  timeRange?: { start: Date; end: Date };
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  selectedEventId,
  onEventSelect,
  timeRange,
}) => {
  const [zoom, setZoom] = useState<'hour' | 'day' | 'week'>('day');
  const [scrollPosition, setScrollPosition] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  const groupedEvents = React.useMemo(() => {
    const groups: Record<string, MotionEvent[]> = {};
    
    events.forEach(event => {
      const key = format(event.timestamp, zoom === 'hour' ? 'yyyy-MM-dd HH:00' : 'yyyy-MM-dd');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    });
    
    return groups;
  }, [events, zoom]);

  const timeLabels = React.useMemo(() => {
    if (zoom === 'hour') {
      return Array.from({ length: 24 }, (_, i) => `${i}:00`);
    }
    if (zoom === 'day') {
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return format(date, 'EEE');
      });
    }
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }, [zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX - scrollPosition);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newScrollPosition = e.clientX - dragStart;
    setScrollPosition(newScrollPosition);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getEventDensity = (events: MotionEvent[]) => {
    if (events.length === 0) return 0;
    if (events.length <= 2) return 1;
    if (events.length <= 5) return 2;
    return 3;
  };

  return (
    <div className="w-full h-24 bg-black/60 backdrop-blur-sm border-t border-b border-white/10">
      {/* Timeline Container */}
      <div
        ref={timelineRef}
        className="relative h-full overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Time Labels */}
        <div className="absolute top-2 left-0 right-0 flex px-4">
          {timeLabels.map((label, index) => (
            <div
              key={index}
              className="flex-1 text-center"
              style={{ minWidth: `${100 / timeLabels.length}%` }}
            >
              <span className="text-xs text-white/50">{label}</span>
            </div>
          ))}
        </div>

        {/* Event Markers */}
        <div
          className="absolute top-8 left-0 right-0 h-12 flex px-4 transition-transform"
          style={{ transform: `translateX(${scrollPosition}px)` }}
        >
          {Object.entries(groupedEvents).map(([timeKey, timeEvents], index) => {
            const density = getEventDensity(timeEvents);
            const width = `${100 / Object.keys(groupedEvents).length}%`;
            
            return (
              <div
                key={timeKey}
                className="relative h-full flex items-center justify-center"
                style={{ width }}
              >
                {/* Event Cluster */}
                <div
                  className={cn(
                    'rounded-full transition-all cursor-pointer hover:scale-110',
                    density === 1 && 'w-3 h-3',
                    density === 2 && 'w-4 h-4',
                    density === 3 && 'w-5 h-5',
                    timeEvents.some(e => e.id === selectedEventId)
                      ? 'bg-blue-500 ring-2 ring-blue-300'
                      : 'bg-blue-400/60'
                  )}
                  onClick={() => timeEvents[0] && onEventSelect?.(timeEvents[0].id)}
                  title={`${timeEvents.length} events`}
                  aria-label={`${timeEvents.length} event${timeEvents.length > 1 ? 's' : ''} at ${format(timeEvents[0].timestamp, 'PPP p')}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (timeEvents[0]) onEventSelect?.(timeEvents[0].id);
                    }
                  }}
                >
                  {/* Event Count Badge */}
                  {timeEvents.length > 1 && (
                    <span className="absolute -top-1 -right-1 text-[8px] font-bold text-white bg-blue-600 rounded-full w-3 h-3 flex items-center justify-center">
                      {timeEvents.length}
                    </span>
                  )}
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {format(timeEvents[0].timestamp, 'PPP p')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Time Indicator */}
        <div className="absolute top-0 bottom-0 w-px bg-red-500/50">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500" />
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1">
        <button
          className={cn(
            'px-2 py-1 text-xs rounded transition-colors',
            zoom === 'hour' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
          )}
          onClick={() => setZoom('hour')}
          aria-label="Zoom to 1 hour"
          aria-pressed={zoom === 'hour'}
        >
          1H
        </button>
        <button
          className={cn(
            'px-2 py-1 text-xs rounded transition-colors',
            zoom === 'day' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
          )}
          onClick={() => setZoom('day')}
          aria-label="Zoom to 1 day"
          aria-pressed={zoom === 'day'}
        >
          1D
        </button>
        <button
          className={cn(
            'px-2 py-1 text-xs rounded transition-colors',
            zoom === 'week' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
          )}
          onClick={() => setZoom('week')}
          aria-label="Zoom to 1 week"
          aria-pressed={zoom === 'week'}
        >
          1W
        </button>
      </div>
    </div>
  );
};
