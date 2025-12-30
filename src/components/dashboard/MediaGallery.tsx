import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera, Clock, Download } from 'lucide-react';
import apiService from '@/services/ApiService';

interface MediaGalleryProps {
  className?: string;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ className }) => {
  const [events, setEvents] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMedia();
    
    // Refresh media every 30 seconds
    const interval = setInterval(loadMedia, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const [eventsResponse, snapshotsResponse] = await Promise.all([
        apiService.getEventsList(),
        apiService.getSnapshots()
      ]);

      setEvents(eventsResponse || []);
      setSnapshots(snapshotsResponse || []);
    } catch (error) {
      console.error('Failed to load media:', error);
      // Set empty arrays on error to prevent undefined issues
      setEvents([]);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (filename: string, type: 'event' | 'snapshot') => {
    return type === 'event' 
      ? apiService.getEventImageUrl(filename)
      : apiService.getSnapshotImageUrl(filename);
  };

  const formatTimestamp = (filename: string) => {
    try {
      const timestamp = filename.split('_')[2]?.split('.')[0];
      if (!timestamp) return 'Unknown';
      
      const date = new Date(timestamp.replace(/-/g, ':').replace('T', ' '));
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const getCameraName = (filename: string) => {
    try {
      return filename.split('_')[1] || 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderImageGrid = (images: string[], type: 'event' | 'snapshot') => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (images.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No {type}s available
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
        {images.map((image) => (
        <Card key={image} className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
          <div 
            className="aspect-video relative"
            onClick={() => setSelectedImage(getImageUrl(image, type))}
          >
            <img
              src={getImageUrl(image, type)}
              alt={`${type} ${formatTimestamp(image)}`}
              className="object-cover w-full h-full"
              onError={(e) => {
                console.error(`Failed to load image: ${getImageUrl(image, type)}`);
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  <span className="text-xs truncate">{getCameraName(image)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">
                    {new Date(formatTimestamp(image)).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
            <button
              className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(getImageUrl(image, type), image);
              }}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </Card>
        ))}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Media Gallery</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="events">
          <TabsList className="w-full">
            <TabsTrigger value="events" className="flex-1">Motion Events ({events.length})</TabsTrigger>
            <TabsTrigger value="snapshots" className="flex-1">Snapshots ({snapshots.length})</TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[600px]">
            <TabsContent value="events" className="mt-0">
              {renderImageGrid(events, 'event')}
            </TabsContent>
            <TabsContent value="snapshots" className="mt-0">
              {renderImageGrid(snapshots, 'snapshot')}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Selected media"
              className="w-full h-auto object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
