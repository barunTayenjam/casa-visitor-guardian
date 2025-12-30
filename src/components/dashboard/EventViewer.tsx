import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Camera as CameraIcon, Calendar, Clock } from 'lucide-react';
import { MotionEvent } from '@/types/security';

interface EventViewerProps {
  events: MotionEvent[];
  onImageClick?: (event: MotionEvent) => void;
}

export const EventViewer: React.FC<EventViewerProps> = ({ events, onImageClick }) => {
  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = event.timestamp.toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, MotionEvent[]>);

  return (
    <div className="w-full"> {/* Removed Card wrapper and CardContent */}
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <div key={date} className="mb-6">
          <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
            <Calendar className="h-4 w-4" />
            {date}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"> {/* Simplified grid columns */}
            {dateEvents.map((event) => (
              <Card
                key={event.id}
                className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all w-full" /* Ensure w-full */
                onClick={() => onImageClick?.(event)}
              >
                <div className="aspect-video relative bg-muted w-full"> {/* Ensure w-full */}
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={`Motion event at ${event.timestamp.toLocaleString()}`}
                      className="object-cover w-full h-full" /* Ensure w-full h-full */
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <CameraIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-1">
                        <CameraIcon className="h-3 w-3" />
                        <span className="text-xs">{event.cameraName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {event.confidence > 0 && (
                    <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded-full">
                      {Math.round(event.confidence * 100)}%
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};


