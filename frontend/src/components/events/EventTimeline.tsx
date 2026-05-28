import React, { useState, useRef, useMemo } from 'react';
import { MotionEvent } from '@/types/security';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface EventTimelineProps {
  events: MotionEvent[];
  selectedEventId?: string;
  onEventSelect?: (eventId: string) => void;
  timeRange?: { start: Date; end: Date };
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events, selectedEventId, onEventSelect }) => {
  const [zoom, setZoom] = useState<'hour' | 'day' | 'week'>('day');
  const [scrollPosition, setScrollPosition] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, MotionEvent[]> = {};
    events.forEach(event => {
      const key = format(event.timestamp, zoom === 'hour' ? 'yyyy-MM-dd HH:00' : 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return groups;
  }, [events, zoom]);

  const timeLabels = useMemo(() => {
    if (zoom === 'hour') return Array.from({ length: 24 }, (_, i) => `${i}:00`);
    if (zoom === 'day') return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return format(d, 'EEE'); });
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }, [zoom]);

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setDragStart(e.clientX - scrollPosition); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging) return; setScrollPosition(e.clientX - dragStart); };
  const handleMouseUp = () => setIsDragging(false);

  const getEventDensity = (events: MotionEvent[]) => {
    if (events.length === 0) return 0;
    if (events.length <= 2) return 1;
    if (events.length <= 5) return 2;
    return 3;
  };

  return (
    <div className="mx-5 mb-4 p-[1px] rounded-[1.25rem] bg-white/[0.08]">
      <div className="rounded-[calc(1.25rem-1px)] bg-card/50 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
        <div className="relative h-20 overflow-hidden cursor-grab active:cursor-grabbing select-none"
          ref={timelineRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        >
          <div className="absolute top-2 left-0 right-0 flex px-4">
            {timeLabels.map((label, index) => (
              <div key={index} className="flex-1 text-center" style={{ minWidth: `${100 / timeLabels.length}%` }}>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="absolute top-8 left-0 right-0 h-12 flex px-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${scrollPosition}px)` }}
          >
            {Object.entries(groupedEvents).map(([timeKey, timeEvents]) => {
              const density = getEventDensity(timeEvents);
              const width = `${100 / Object.keys(groupedEvents).length}%`;
              return (
                <div key={timeKey} className="relative h-full flex items-center justify-center" style={{ width }}>
                  <div
                    className={cn(
                      'rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer hover:scale-110',
                      density === 1 && 'w-2.5 h-2.5',
                      density === 2 && 'w-3.5 h-3.5',
                      density === 3 && 'w-4.5 h-4.5',
                      timeEvents.some(e => e.id === selectedEventId) ? 'bg-primary ring-2 ring-primary/40' : 'bg-primary/40'
                    )}
                    onClick={() => timeEvents[0] && onEventSelect?.(timeEvents[0].id)}
                    title={`${timeEvents.length} events`}
                    aria-label={`${timeEvents.length} event${timeEvents.length > 1 ? 's' : ''} at ${format(timeEvents[0].timestamp, 'PPP p')}`}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (timeEvents[0]) onEventSelect?.(timeEvents[0].id); } }}
                  >
                    {timeEvents.length > 1 && (
                      <span className="absolute -top-1 -right-1 text-[7px] font-bold text-white bg-primary rounded-full w-2.5 h-2.5 flex items-center justify-center">
                        {timeEvents.length}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="absolute top-0 bottom-0 w-px bg-red-500/30">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-3 border-r-3 border-t-3 border-l-transparent border-r-transparent border-t-red-500" />
          </div>
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-0.5 p-0.5 rounded-[0.75rem] bg-white/[0.06] border border-white/[0.12]">
          {(['hour', 'day', 'week'] as const).map((z) => (
            <button key={z}
              className={cn('px-2.5 py-1 text-[10px] rounded-[0.5rem] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]', zoom === z ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setZoom(z)}
              aria-label={`Zoom to 1 ${z}`} aria-pressed={zoom === z}
            >
              {z === 'hour' ? '1H' : z === 'day' ? '1D' : '1W'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
