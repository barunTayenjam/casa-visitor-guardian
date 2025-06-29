import React, { useState } from 'react';
import { EventViewer } from '@/components/dashboard/EventViewer';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import apiService from '@/services/ApiService';
import { MotionEvent } from '@/types/security';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

const MotionEvents = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = React.useCallback(async () => {
    try {
      setLoading(true);
      const fetchedEvents = await apiService.getMotionEvents();
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load motion events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const downloadImage = (event: MotionEvent) => {
    const link = document.createElement('a');
    link.href = event.imageUrl;
    link.download = `motion_${event.cameraName}_${event.timestamp.toISOString()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Motion Events</h1>
          <p className="text-muted-foreground mt-2">
            Review detected motion events from all cameras
          </p>
        </div>
        <Button onClick={() => loadEvents()}>
          Refresh Events
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <EventViewer 
          events={events}
          onImageClick={(event) => setSelectedEvent(event)}
        />
      )}

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-4xl">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 z-10"
              onClick={() => setSelectedEvent(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {selectedEvent && (
              <>
                <img
                  src={selectedEvent.imageUrl}
                  alt={`Motion event at ${selectedEvent.timestamp.toLocaleString()}`}
                  className="w-full rounded-lg"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{selectedEvent.cameraName}</h3>
                      <p className="text-sm text-white/80">
                        {selectedEvent.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-white/20"
                      onClick={() => selectedEvent && downloadImage(selectedEvent)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MotionEvents;
