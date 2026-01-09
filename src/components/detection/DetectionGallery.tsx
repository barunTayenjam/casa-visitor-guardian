import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  UserCheck, 
  Calendar, 
  Clock, 
  Image as ImageIcon,
  Filter,
  Grid3X3,
  List,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Video,
  User,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import apiService, { EnhancedEvent } from '@/services/ApiService';
import ImageDetectionDetails from './ImageDetectionDetails';
import { useSocketContext } from '@/contexts/SocketContext';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';

interface DetectionGalleryProps {
  className?: string;
}

const DetectionGallery: React.FC<DetectionGalleryProps> = ({ className }) => {
  const [events, setEvents] = useState<EnhancedEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EnhancedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | 'all'>('24h');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [availableCameras, setAvailableCameras] = useState<string[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  
  const { socket } = useSocketContext();

  const timeRangeLabels = {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    'all': 'All Time'
  };

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [timeRange, cameraFilter]);

  useEffect(() => {
    loadEvents();
    loadCameras();
  }, [timeRange, cameraFilter, currentPage, viewMode]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleMotionDetected = (data: any) => {
      // Create a temporary EnhancedEvent from the motion event data
      // Note: Real-time events might initially lack full detection details until processed
      const newEvent: EnhancedEvent = {
        id: data.id || `evt_${Date.now()}`,
        event_type: 'motion', // Default to motion
        filename: data.imagePath ? data.imagePath.split('/').pop() : `motion_${Date.now()}.jpg`,
        timestamp: new Date(data.timestamp || Date.now()),
        cameraId: data.cameraId || 'unknown',
        confidence: data.confidence || 0,
        metadata: data.metadata || {},
        persons_detected: data.metadata?.personCount || 0,
        faces_detected: data.metadata?.faceCount || 0,
        known_faces_count: data.metadata?.knownFaces || 0,
        unknown_faces_count: data.metadata?.unknownFaces || 0,
        object_detections: [],
        face_detections: []
      };

      // Only add if it matches current camera filter
      if (cameraFilter === 'all' || cameraFilter === newEvent.cameraId) {
        // Only prepend if on first page
        if (currentPage === 1) {
          setEvents(prev => [newEvent, ...prev].slice(0, viewMode === 'grid' ? 12 : 20));
        }
      }
    };

    socket.on('motionDetected', handleMotionDetected);
    
    return () => {
      socket.off('motionDetected', handleMotionDetected);
    };
  }, [socket, cameraFilter, currentPage, viewMode]);

  const loadCameras = async () => {
    try {
      const cameras = await apiService.getCameras();
      setAvailableCameras(cameras.map(c => c.id));
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  };

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      // Calculate start/end dates based on timeRange
      let startDate: string | undefined;
      const now = new Date();
      
      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
          break;
        case '6h':
          startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          startDate = undefined;
      }

      const pageSize = viewMode === 'grid' ? 12 : 20;

      const response = await apiService.getEnhancedEventsList({ 
        page: currentPage,
        pageSize: pageSize,
        camera_id: cameraFilter !== 'all' ? cameraFilter : undefined,
        start_date: startDate
      });
      
      if (response.success && response.events) {
        // Ensure dates are Date objects
        const parsedEvents = response.events.map(e => ({
          ...e,
          timestamp: new Date(e.timestamp)
        }));
        setEvents(parsedEvents);
        
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setTotalEvents(response.pagination.totalEvents);
        }
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of list/grid
    const container = document.querySelector('.scroll-area-content');
    if (container) {
      container.scrollTop = 0;
    }
  };

  const handleImageClick = async (event: EnhancedEvent, index: number) => {
    // If we have full details already, just show them. 
    // Otherwise fetch details to get bounding boxes if missing.
    if (!event.object_detections || !event.face_detections) {
      try {
        const details = await apiService.getEventDetails(event.id);
        if (details.success) {
          setSelectedEvent(details.event);
        } else {
          setSelectedEvent(event);
        }
      } catch (e) {
        console.error("Error fetching details", e);
        setSelectedEvent(event);
      }
    } else {
      setSelectedEvent(event);
    }
    
    setSelectedIndex(index);
    setIsImageDialogOpen(true);
  };

  const handleDownloadImage = async (event: EnhancedEvent) => {
    try {
      const response = await fetch(`/api/events/image/${event.filename}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = event.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const stats = {
    total: totalEvents, // Use total from pagination
    withPersons: events.filter(e => e.persons_detected > 0).length, // Current page only stats
    withFaces: events.filter(e => e.faces_detected > 0).length,
    cameras: new Set(events.map(e => e.cameraId)).size
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <ImageIcon className="h-4 w-4 inline mr-2" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 inline mr-2" />
              With Persons (Page)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.withPersons}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <UserCheck className="h-4 w-4 inline mr-2" />
              With Faces (Page)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withFaces}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Video className="h-4 w-4 inline mr-2" />
              Cameras (Page)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cameras}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last Hour</SelectItem>
                    <SelectItem value="6h">Last 6 Hours</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={cameraFilter} onValueChange={setCameraFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Cameras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cameras</SelectItem>
                    {availableCameras.map(camera => (
                      <SelectItem key={camera} value={camera}>{camera}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Events Grid/List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              <Calendar className="h-5 w-5 inline mr-2" />
              Detection Events
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-normal">
                Page {currentPage} of {totalPages}
              </span>
              <Badge variant="outline">
                {timeRangeLabels[timeRange]}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && events.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="mx-auto h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No events found</p>
              <p className="text-sm mt-2">Try adjusting time range or camera filter</p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[500px]">
                  {events.map((event, index) => (
                    <div
                      key={event.id || event.filename}
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer group h-fit"
                      onClick={() => handleImageClick(event, index)}
                    >
                      <div className="aspect-video bg-muted relative">
                        <img
                          src={`/api/events/image/${event.filename}`}
                          alt={event.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        
                        {/* Detection badges */}
                        {(event.persons_detected > 0 || event.faces_detected > 0) && (
                          <div className="absolute top-2 left-2 flex gap-1">
                            {event.persons_detected > 0 && (
                              <Badge className="bg-green-500 text-white">
                                <Users className="h-3 w-3 mr-1" />
                                {event.persons_detected}
                              </Badge>
                            )}
                            {event.faces_detected > 0 && (
                              <Badge className="bg-blue-500 text-white">
                                <UserCheck className="h-3 w-3 mr-1" />
                                {event.faces_detected}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <div className="text-sm font-medium truncate" title={event.filename}>
                          {event.filename}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <Video className="h-3 w-3 mr-1" />
                            {event.cameraId}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(event.timestamp, 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-1 text-xs">
                          {event.persons_detected > 0 && (
                            <span className="text-green-600">
                              {event.persons_detected} person(s)
                            </span>
                          )}
                          {event.faces_detected > 0 && (
                            <span className="text-blue-600">
                              {event.known_faces_count} known, {event.unknown_faces_count} unknown
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 min-h-[500px]">
                  {events.map((event, index) => (
                    <div
                      key={event.id || event.filename}
                      className="flex items-center gap-4 p-3 border rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleImageClick(event, index)}
                    >
                      <div className="w-32 h-20 bg-muted rounded relative overflow-hidden flex-shrink-0">
                        <img
                          src={`/api/events/image/${event.filename}`}
                          alt={event.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium truncate" title={event.filename}>
                            {event.filename}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {event.persons_detected > 0 && (
                              <Badge className="bg-green-500 text-white text-xs">
                                {event.persons_detected}P
                              </Badge>
                            )}
                            {event.faces_detected > 0 && (
                              <Badge className="bg-blue-500 text-white text-xs">
                                {event.faces_detected}F
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{event.cameraId}</span>
                          <span>•</span>
                          <span>{format(event.timestamp, 'MMM dd, yyyy HH:mm:ss')}</span>
                        </div>
                        
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="text-green-600">
                            {event.persons_detected} person(s)
                          </span>
                          <span className="text-blue-600">
                            {event.known_faces_count} known, {event.unknown_faces_count} unknown
                          </span>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) handlePageChange(currentPage - 1);
                          }}
                          className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      
                      {/* Simple pagination logic for brevity */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = currentPage - 2 + i;
                          if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                        }
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink 
                              href="#" 
                              isActive={currentPage === pageNum}
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(pageNum);
                              }}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) handlePageChange(currentPage + 1);
                          }}
                          className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Image Detail Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={(open) => {
        setIsImageDialogOpen(open);
        if (!open) {
          setSelectedEvent(null);
          setSelectedEnhancedEvent(null);
          setObjectDetections([]);
          setFaceDetections([]);
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="truncate max-w-[500px]" title={selectedEvent?.filename}>
              {selectedEvent?.filename}
            </DialogTitle>
            <DialogDescription>
              View detailed information about the selected detection event
            </DialogDescription>
          </DialogHeader>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedEvent && handleDownloadImage(selectedEvent)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newIndex = Math.max(0, selectedIndex - 1);
                    handleImageClick(events[newIndex], newIndex);
                  }}
                  disabled={selectedIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newIndex = Math.min(events.length - 1, selectedIndex + 1);
                    handleImageClick(events[newIndex], newIndex);
                  }}
                  disabled={selectedIndex === events.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {selectedEvent && (
            <ScrollArea className="flex-1 p-4">
              <ImageDetectionDetails
                imageUrl={`/api/events/image/${selectedEvent.filename}`}
                objectDetections={selectedEvent.object_detections?.map(obj => ({
                  confidence: obj.confidence,
                  boundingBox: obj.bbox || (obj as any).boundingBox
                })) || []}
                faceDetections={selectedEvent.face_detections?.map(face => ({
                  confidence: face.confidence,
                  boundingBox: face.bbox || (face as any).boundingBox,
                  personId: face.id,
                  personName: face.name,
                  isKnown: face.isKnown
                })) || []}
                filename={selectedEvent.filename}
                timestamp={selectedEvent.timestamp.toISOString()}
                cameraId={selectedEvent.cameraId}
              />
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetectionGallery;