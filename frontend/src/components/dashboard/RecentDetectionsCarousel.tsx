import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Camera as CameraIcon,
  Clock,
  MapPin,
  Activity,
  Eye,
  Maximize2,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Share2
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Detection } from '@/types/security';
import { DetectionOverlay } from './DetectionOverlay';
import { MotionEvent } from '@/types/security';
import apiService from '@/services/ApiService';

interface RecentDetectionsCarouselProps {
  limit?: number;
}

export const RecentDetectionsCarousel = ({ limit = 12 }: RecentDetectionsCarouselProps) => {
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load recent events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const { events: historicalEvents } = await apiService.getHistoricalEvents({
          pageSize: limit,
          sortBy: 'newest'
        });
        setEvents(historicalEvents);
      } catch (error) {
        console.error('Failed to load recent detections:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();

    // Refresh every 30 seconds
    const interval = setInterval(loadEvents, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getLabelColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'person':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'face':
        return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
      case 'vehicle':
        return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      case 'animal':
        return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'package':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const handleImageClick = (event: MotionEvent) => {
    console.log('[RecentDetectionsCarousel] Clicked event:', {
      id: event.id,
      confidence: event.confidence,
      lightLevel: event.lightLevel,
      detections: event.detections,
      detectionCount: event.detections?.length || 0
    });
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  const handleDownload = () => {
    if (selectedEvent?.imageUrl) {
      const link = document.createElement('a');
      link.href = selectedEvent.imageUrl;
      link.download = `detection_${selectedEvent.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-gray-400">Loading detections...</div>
          </div>
        </div>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Activity className="w-16 h-16 text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No Recent Detections</h3>
          <p className="text-sm text-gray-500">
            Motion detection events will appear here when your cameras detect activity.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-slate-900/95 border-slate-800 overflow-hidden">
        <div className="px-3 py-1.5 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <h2 className="text-xs font-semibold text-white">Recent Detections</h2>
            </div>
            <Badge variant="outline" className="bg-slate-800 text-gray-300 border-slate-600 text-[10px]">
              {events.length}
            </Badge>
          </div>
        </div>

        <div className="px-3 py-2">
          <Carousel
            opts={{
              align: "start",
              loop: false,
            }}
            className="w-full"
          >
            <CarouselContent>
              {events.map((event, index) => (
                <CarouselItem key={event.id} className="basis-1/6 md:basis-1/4 lg:basis-1/5 xl:basis-1/6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group relative cursor-pointer"
                    onClick={() => handleImageClick(event)}
                  >
                    <div className="relative aspect-video bg-slate-800 rounded overflow-hidden border border-slate-700 hover:border-blue-500 transition-all duration-200 hover:scale-105">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={`Detection from ${event.cameraName}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-event.jpg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CameraIcon className="w-12 h-12 text-slate-600" />
                        </div>
                      )}

                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Maximize2 className="w-12 h-12 text-white transform scale-0 group-hover:scale-100 transition-transform duration-200" />
                      </div>

                      {/* Info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-2 py-1.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-[10px] font-medium line-clamp-1">
                              {event.cameraName}
                            </span>
                            <span className="text-gray-300 text-[9px]">
                              {formatTimeAgo(event.timestamp)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-wrap">
                            {event.labels.slice(0, 2).map((label) => (
                              <Badge
                                key={label}
                                variant="outline"
                                className={`text-[9px] ${getLabelColor(label)}`}
                              >
                                {label}
                              </Badge>
                            ))}
                            {event.labels.length > 2 && (
                              <Badge variant="outline" className="text-[9px] bg-slate-600 text-slate-300">
                                +{event.labels.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Confidence indicator */}
                      <div className="absolute top-1.5 right-1.5 bg-black/70 px-1.5 py-0.5 rounded">
                        <span className="text-white text-[9px] font-medium">
                          {Math.round(event.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {events.length > 6 && (
              <>
                <CarouselPrevious className="bg-slate-800 border-slate-700 hover:bg-slate-700" />
                <CarouselNext className="bg-slate-800 border-slate-700 hover:bg-slate-700" />
              </>
            )}
          </Carousel>
        </div>
      </Card>

      {/* Zoom Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-full bg-slate-900 border-slate-700">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="text-white">Detection Details</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      {selectedEvent.cameraName} • {selectedEvent.timestamp.toLocaleString()}
                    </DialogDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </Button>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[80vh]">
                <div className="space-y-6 pr-4">
                  {/* Large Image Preview */}
                  <div className="relative bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                    {selectedEvent.imageUrl ? (
                      <>
                        <img
                          src={selectedEvent.imageUrl}
                          alt={`Detection from ${selectedEvent.cameraName}`}
                          className="w-full h-auto object-contain max-h-[60vh]"
                        />
                        {/* Detection Overlay with Bounding Boxes */}
                        {selectedEvent.detections && selectedEvent.detections.length > 0 && (
                          <div className="absolute inset-0 pointer-events-none z-20">
                            {selectedEvent.detections.map((detection, index) => (
                              <div
                                key={`${detection.type}-${index}`}
                                className="absolute border-2 rounded-sm backdrop-blur-sm"
                                style={{
                                  left: `${detection.boundingBox?.x || 0}px`,
                                  top: `${detection.boundingBox?.y || 0}px`,
                                  width: `${detection.boundingBox?.width || 0}px`,
                                  height: `${detection.boundingBox?.height || 0}px`,
                                  borderColor:
                                    detection.type === 'person'
                                      ? '#00ff00'
                                      : detection.type === 'face'
                                        ? '#ff00ff'
                                        : '#00ffff',
                                  backgroundColor:
                                    detection.type === 'person'
                                      ? 'rgba(0, 255, 0, 0.4)'
                                      : detection.type === 'face'
                                        ? 'rgba(255, 0, 255, 0.4)'
                                        : 'rgba(0, 255, 255, 0.4)',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                }}
                              >
                                <div className="absolute -top-7 left-1 right-1 bg-black/80 text-white px-2 py-1.5 rounded-md text-xs font-medium flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <span className="capitalize">{detection.type}</span>
                                    {detection.name && (
                                      <span className="text-gray-300 ml-1">
                                        {detection.isKnown ? '✓' : '?'}
                                      </span>
                                    )}
                                  </span>
                                  <span className="bg-black/50 px-1.5 py-0.5 rounded text-[11px]">
                                    {Math.round(detection.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full aspect-video flex items-center justify-center">
                        <CameraIcon className="w-20 h-20 text-slate-600" />
                      </div>
                    )}
                  </div>

                  {/* Detection Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Camera Info */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <CameraIcon className="w-4 h-4" />
                        Camera
                      </h4>
                      <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Name</span>
                          <span className="text-white text-sm font-medium">{selectedEvent.cameraName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Location</span>
                          <span className="text-white text-sm font-medium">{selectedEvent.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Time Info */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time
                      </h4>
                      <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Detected</span>
                          <span className="text-white text-sm font-medium">
                            {selectedEvent.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Duration</span>
                          <span className="text-white text-sm font-medium">
                            {selectedEvent.duration}s
                          </span>
                        </div>
                      </div>
                    </div>

                  {/* Detection Info */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Detection
                    </h4>
                    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Confidence</span>
                        <span className="text-white text-sm font-medium">
                          {selectedEvent.confidence !== undefined && selectedEvent.confidence !== null ? Math.round(selectedEvent.confidence * 100) + '%' : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">ID</span>
                        <span className="text-white text-sm font-mono text-xs">
                          {selectedEvent.id ? selectedEvent.id.slice(0, 8) + '...' : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Labels */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Detected Objects
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.labels.map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className={`text-sm ${getLabelColor(label)}`}
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Metadata */}
                  {selectedEvent.metadata && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Additional Details
                      </h4>
                      <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                        {selectedEvent.personCount !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Persons Detected</span>
                            <span className="text-white text-sm font-medium">
                              {selectedEvent.personCount}
                            </span>
                          </div>
                        )}
                        {selectedEvent.faceCount !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Faces Detected</span>
                            <span className="text-white text-sm font-medium">
                              {selectedEvent.faceCount}
                            </span>
                          </div>
                        )}
                        {selectedEvent.lightLevel !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Light Level</span>
                            <span className="text-white text-sm font-medium">
                              {Math.round(selectedEvent.lightLevel * 100)}%
                            </span>
                          </div>
                        )}
                        {selectedEvent.motionArea !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Motion Area</span>
                            <span className="text-white text-sm font-medium">
                              {Math.round(selectedEvent.motionArea)}px²
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-slate-700">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      disabled={!selectedEvent.imageUrl}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
