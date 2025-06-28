import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera as CameraIcon, Calendar, Clock } from 'lucide-react';
import { MotionEvent } from '@/types/security';

interface EventViewerProps {
  events: MotionEvent[];
  onImageClick?: (event: MotionEvent) => void;
}

export const EventViewer: React.FC<EventViewerProps> = ({ events, onImageClick }) => {
  // Sort events by timestamp descending (newest first)
  const sortedEvents = [...events].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );

  // Group events by date
  const groupedEvents = sortedEvents.reduce((acc, event) => {
    const date = event.timestamp.toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, MotionEvent[]>);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Motion Events</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {Object.entries(groupedEvents).map(([date, dateEvents]) => (
            <div key={date} className="mb-6">
              <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                <Calendar className="h-4 w-4" />
                {date}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateEvents.map((event) => (
                  <Card
                    key={event.id}
                    className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => onImageClick?.(event)}
                  >
                    <div className="aspect-video relative">
                      <img
                        src={event.imageUrl}
                        alt={`Motion event at ${event.timestamp.toLocaleString()}`}
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        <div className="flex items-center justify-between text-white">
                          <div className="flex items-center gap-2">
                            <CameraIcon className="h-4 w-4" />
                            <span className="text-sm">{event.cameraName}</span>
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
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {event.confidence}% confidence
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
