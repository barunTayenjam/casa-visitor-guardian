import React from 'react';
import { Camera, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MotionEvent } from '@/types/security';
import { useEvents } from '@/contexts/EventsContext';

interface MediaViewerProps {
  selectedEvent: MotionEvent | null;
  onClose: () => void;
  onSelectEvent: (event: MotionEvent) => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ selectedEvent, onClose, onSelectEvent }) => {
  const { events } = useEvents(); // Get all events from context

  const handleDownload = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageUrl.split('/').pop() || 'event.jpg';
    document.body.appendChild(link);
    link.removeChild(link);
  };

  // Filter out archived events and sort by timestamp (newest first)
  const nonArchivedEvents = events
    .filter(event => !event.archived)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <>
      {/* Media Gallery at the bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur border-t z-50 p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <span className="text-sm font-medium">Recent Motion Events</span>
          </div>
          {/* Refresh button removed as events are now from context */}
        </div>
        
        <ScrollArea className="h-24">
          <div className="flex gap-2 pb-2">
            {nonArchivedEvents.length === 0 ? (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground text-sm">
                No recent events to display.
              </div>
            ) : (
              nonArchivedEvents.map((event) => (
                <button
                  key={event.id}
                  className="relative h-24 aspect-video bg-black rounded-lg cursor-pointer group"
                  onClick={() => onSelectEvent(event)}
                >
                  <img
                    src={event.imageUrl}
                    alt={`Event at ${event.timestamp.toLocaleTimeString()}`}
                    className="h-full w-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end">
                    <div className="w-full p-2 text-white text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{event.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Full-screen Media Viewer Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl">
          {selectedEvent && (
            <div className="relative">
              <img
                src={selectedEvent.imageUrl}
                alt={`Event from ${selectedEvent.cameraName} at ${selectedEvent.timestamp.toLocaleString()}`}
                className="w-full h-auto"
              />
              <Button
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleDownload(selectedEvent.imageUrl)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                {selectedEvent.cameraName} - {selectedEvent.timestamp.toLocaleString()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
