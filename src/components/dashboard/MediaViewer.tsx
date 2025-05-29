import React, { useState, useEffect } from 'react';
import { Camera, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MediaViewerProps {
  selectedCameraId?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ selectedCameraId }) => {
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const loadMedia = async () => {
    try {
      setLoading(true);
      // In development mode, use relative URL; in production, use full URL from env
      const url = import.meta.env.DEV 
        ? '/api/events/list'
        : `${import.meta.env.VITE_API_URL}/events/list`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success && Array.isArray(data.files)) {
        setEvents(data.files);
      }
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
    const interval = setInterval(loadMedia, 30000);
    return () => clearInterval(interval);
  }, [selectedCameraId]);

  const formatTimestamp = (filename: string) => {
    try {
      const timestamp = filename.split('_')[2]?.split('.')[0];
      if (!timestamp) return 'Unknown';
      const date = new Date(timestamp.replace(/-/g, ':').replace('T', ' '));
      return date.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  if (loading && events.length === 0) return null;
  if (!events.length) return null;

  // In development, use relative URLs; in production, use the base URL from env
  const baseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:9753');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur border-t z-50 p-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4" />
          <span className="text-sm font-medium">Recent Events</span>
        </div>
        <Button variant="ghost" size="sm" onClick={loadMedia}>
          Refresh
        </Button>
      </div>
      
      <ScrollArea className="h-24">
        <div className="flex gap-2 pb-2">
          {events.map((event) => (
            <button
              key={event}
              className="relative h-24 aspect-video bg-black rounded-lg cursor-pointer group"
              onClick={() => setSelectedImage(`${baseUrl}/events/${event}`)}
            >
              <img
                src={`${baseUrl}/events/${event}`}
                alt={`Event at ${formatTimestamp(event)}`}
                className="h-full w-full object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end">
                <div className="w-full p-2 text-white text-xs">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatTimestamp(event)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage}
                alt="Event"
                className="w-full h-auto"
              />
              <Button
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = selectedImage;
                  link.download = selectedImage.split('/').pop() || 'event.jpg';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
