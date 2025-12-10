import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Camera as CameraIcon, Clock } from 'lucide-react';
import { MotionEvent } from '@/types/security';
import { format } from 'date-fns';

interface EventGridProps {
  events: MotionEvent[];
  onImageClick?: (event: MotionEvent) => void;
}

export const EventGrid: React.FC<EventGridProps> = ({ events, onImageClick }) => {
  console.log("EventGrid: Rendering", events.length, "events");
  
  if (events.length === 0) {
    console.log("EventGrid: No events to display");
    return (
      <div className="text-center py-8 text-muted-foreground">
        No motion events found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {events.map((event) => {
        console.log("EventGrid: Processing event", event.id, "with imageUrl", event.imageUrl);
        return (
          <Card
            key={event.id}
            className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => onImageClick?.(event)}
          >
          <div className="aspect-video relative bg-muted w-full">
            {event.imageUrl ? (
              <img
                src={event.imageUrl}
                alt={`Motion event at ${event.timestamp.toLocaleString()}`}
                className="object-cover w-full h-full"
                loading="lazy"
                onError={(e) => {
                  console.error("Image failed to load:", event.imageUrl, e);
                  console.error("Current window location:", window.location.href);
                  console.error("Attempting to load from:", new URL(event.imageUrl, window.location.href).href);
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = '/placeholder-camera.jpg';
                  target.alt = 'Image not available';
                  target.style.display = 'block';
                }}
                onLoad={() => {
                  console.log("Image loaded successfully:", event.imageUrl);
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
                    {format(event.timestamp, 'HH:mm:ss')}
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
        );
      })}
    </div>
  );
};
