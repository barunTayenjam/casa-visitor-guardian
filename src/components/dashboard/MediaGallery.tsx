import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Camera, Clock, Download, User, UserCheck, UserX, Package } from 'lucide-react';
import apiService, { EnhancedEvent, DetectionData, FaceDetectionData } from '@/services/ApiService';

interface MediaGalleryProps {
  className?: string;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ className }) => {
  const [events, setEvents] = useState<EnhancedEvent[]>([]);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EnhancedEvent | null>(null);
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
        apiService.getEnhancedEventsList({ limit: 100 }),
        apiService.getSnapshots()
      ]);

      setEvents(eventsResponse?.events || []);
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
      ? `${API_URL}/events/image/${filename}`
      : `${API_URL}/snapshots/image/${filename}`;
  };

  const API_URL = '/api';

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

  // NEW: Render enhanced event grid with detection data
  const renderEnhancedEventGrid = (enhancedEvents: EnhancedEvent[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (enhancedEvents.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No events available
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
        {enhancedEvents.map((event) => (
          <Card 
            key={event.id} 
            className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => {
              setSelectedEvent(event);
              setSelectedImage(`${API_URL}/events/image/${event.filename}`);
            }}
          >
            <div className="aspect-video relative">
              <img
                src={`${API_URL}/events/image/${event.filename}`}
                alt={`Event ${event.filename}`}
                className="object-cover w-full h-full"
                onError={(e) => {
                  console.error(`Failed to load event image: ${event.filename}`);
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    <span className="text-xs truncate">{event.cameraId}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(`${API_URL}/events/image/${event.filename}`, event.filename);
                }}
              >
                <Download className="h-4 w-4" />
              </button>
              {/* Detection badges */}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {event.persons_detected > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="text-xs">{event.persons_detected} person(s)</span>
                  </Badge>
                )}
                {event.faces_detected > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    <span className="text-xs">{event.faces_detected} face(s)</span>
                  </Badge>
                )}
                {event.object_detections && event.object_detections.length > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    <span className="text-xs">{event.object_detections.length} object(s)</span>
                  </Badge>
                )}
              </div>
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
              {renderEnhancedEventGrid(events)}
            </TabsContent>
            <TabsContent value="snapshots" className="mt-0">
              {renderImageGrid(snapshots, 'snapshot')}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>

      <Dialog open={!!selectedImage} onOpenChange={() => { setSelectedImage(null); setSelectedEvent(null); }}>
        <DialogContent className="max-w-4xl">
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage}
                alt="Selected media"
                className="w-full h-auto object-contain rounded-lg"
              />
              {/* Show detection details if available */}
              {selectedEvent && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Detections</h4>
                      <div className="space-y-2">
                        {selectedEvent.persons_detected > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{selectedEvent.persons_detected} person(s)</span>
                            </Badge>
                          </div>
                        )}
                        {selectedEvent.faces_detected > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              <span>{selectedEvent.faces_detected} face(s)</span>
                            </Badge>
                          </div>
                        )}
                        {selectedEvent.known_faces_count > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-500 hover:bg-green-600">
                              {selectedEvent.known_faces_count} known face(s)
                            </Badge>
                          </div>
                        )}
                        {selectedEvent.unknown_faces_count > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-yellow-500 hover:bg-yellow-600">
                              {selectedEvent.unknown_faces_count} unknown face(s)
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Event Details</h4>
                      <div className="text-sm space-y-1">
                        <div>Camera: {selectedEvent.cameraId}</div>
                        <div>Time: {new Date(selectedEvent.timestamp).toLocaleString()}</div>
                        <div>Confidence: {Math.round((selectedEvent.confidence || 0) * 100)}%</div>
                      </div>
                    </div>
                  </div>
                  {/* Show object detections if available */}
                  {selectedEvent.object_detections && selectedEvent.object_detections.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Objects Detected</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.object_detections.map((detection: DetectionData, index: number) => (
                          <Badge key={index} className="bg-blue-500 hover:bg-blue-600">
                            {detection.class} ({Math.round(detection.confidence * 100)}%)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Show face detections if available */}
                  {selectedEvent.face_detections && selectedEvent.face_detections.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Faces Detected</h4>
                      <div className="space-y-2">
                        {selectedEvent.face_detections.map((face: FaceDetectionData, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <Badge className={face.isKnown ? "bg-green-500 hover:bg-green-600" : "bg-yellow-500 hover:bg-yellow-600"}>
                              {face.isKnown ? "Known" : "Unknown"}
                            </Badge>
                            {face.isKnown && <span className="text-sm">{face.name}</span>}
                            <span className="text-sm text-muted-foreground">
                              ({Math.round(face.confidence * 100)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
