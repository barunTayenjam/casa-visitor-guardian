import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import apiService, { ApiError } from '@/services/ApiService';
import { MotionEvent } from '@/types/security';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Download,
  X,
  Search,
  Calendar as CalendarIcon,
  Camera as CameraIcon,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  UserCheck,
  UserX,
  PersonStanding,
  ScanFace,
  Sun,
  Activity,
  Clock,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Layers,
  Eye,
  EyeOff,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Keyboard
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCameras } from '@/contexts/CameraContext';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';

// Helper function to format confidence - handles both decimal (0-1) and percentage (0-100)
const formatConfidence = (confidence: number): string => {
  if (confidence >= 1) {
    // Already a percentage
    return `${Math.round(confidence)}%`;
  }
  // Convert decimal to percentage
  return `${Math.round(confidence * 100)}%`;
};

const MotionEvents = () => {
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [selectedDetectionType, setSelectedDetectionType] = useState<'all' | 'face' | 'person' | 'motion'>('all');

  const loadEvents = useCallback(async () => {
    console.log('Loading events for MotionEvents page...');
    setLoading(true);
    try {
      const response = await apiService.getEnhancedEventsList({
        page: currentPage,
        pageSize: 12, // Fixed to 12 for 4x3 grid
        camera_id: selectedCamera === 'all' ? undefined : selectedCamera,
        start_date: selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0).toISOString() : undefined,
        end_date: selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999).toISOString() : undefined,
        sortBy: sortBy,
        event_type: selectedDetectionType === 'all' ? undefined : selectedDetectionType,
        searchQuery: searchQuery || undefined
      });
      console.log("Fetched motion events:", response.events);
      const transformedEvents = response.events.map((event: any): MotionEvent => {
        // Build detections array from object_detections and face_detections
        const detections: MotionEvent['detections'] = [];
        
        // Add person/object detections
        if (event.object_detections && Array.isArray(event.object_detections)) {
          event.object_detections.forEach((det: any) => {
            detections.push({
              type: det.class?.toLowerCase().includes('person') ? 'person' : 'object',
              confidence: det.confidence,
              boundingBox: {
                x: det.boundingBox?.[0] || 0,
                y: det.boundingBox?.[1] || 0,
                width: det.boundingBox?.[2] || 0,
                height: det.boundingBox?.[3] || 0
              }
            });
          });
        }
        
        // Add face detections
        if (event.face_detections && Array.isArray(event.face_detections)) {
          event.face_detections.forEach((det: any) => {
            detections.push({
              type: 'face',
              confidence: det.confidence,
              name: det.personName,
              isKnown: det.isKnown,
              boundingBox: {
                x: det.boundingBox?.[0] || 0,
                y: det.boundingBox?.[1] || 0,
                width: det.boundingBox?.[2] || 0,
                height: det.boundingBox?.[3] || 0
              }
            });
          });
        }
        
        return {
          id: event.id,
          cameraId: event.cameraId,
          cameraName: event.cameraName || `Camera ${event.cameraId}`,
          timestamp: new Date(event.timestamp),
          imageUrl: event.imageUrl || event.filename || null,
          confidence: event.confidence || 0,
          labels: event.labels || [event.event_type || 'motion'],
          location: event.cameraName || `Camera ${event.cameraId}`,
          duration: 0,
          archived: false,
          metadata: event.metadata || {},
          boundingBox: event.boundingBox ? {
            x: event.boundingBox.x || event.boundingBox[0] || 0,
            y: event.boundingBox.y || event.boundingBox[1] || 0,
            width: event.boundingBox.width || event.boundingBox[2] || 0,
            height: event.boundingBox.height || event.boundingBox[3] || 0
          } : undefined,
          detections,
          personCount: event.persons_detected || event.personCount || (detections.filter(d => d.type === 'person').length),
          faceCount: event.faces_detected || event.faceCount || (detections.filter(d => d.type === 'face').length),
          knownFaces: event.known_faces_count || event.knownFaces || (detections.filter(d => d.type === 'face' && d.isKnown).length),
          unknownFaces: event.unknown_faces_count || event.unknownFaces || (detections.filter(d => d.type === 'face' && !d.isKnown).length),
          lightLevel: event.lightLevel,
          motionArea: event.motionArea,
          rawMetadata: event
        };
      });
      setEvents(transformedEvents);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalEvents(response.pagination?.totalEvents || 0);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast({
        title: 'Error',
        description: `Failed to load motion events: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: 'destructive',
      });
      setEvents([]);
      setTotalPages(1);
      setTotalEvents(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCamera, searchQuery, selectedDate, sortBy, toast, selectedDetectionType]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Keyboard navigation for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedEventIndex === null) return;
      
      if (e.key === 'Escape') {
        setSelectedEventIndex(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedEventIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedEventIndex(prev => prev !== null && prev < events.length - 1 ? prev + 1 : prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventIndex, events.length]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedEventIndex(null);
  };

  const handleArchiveEvent = async (eventId: string) => {
    if (window.confirm("Are you sure you want to archive this event?")) {
      try {
        await apiService.archiveEvent(eventId);
        toast({
          title: "Event Archived",
          description: "The motion event has been archived.",
        });
        loadEvents(); // Refresh list after archiving
        setSelectedEventIndex(null);
      } catch (error) {
        console.error(`Failed to archive event ${eventId}:`, error);
        toast({
          title: "Error",
          description: `Failed to archive event: ${error instanceof ApiError ? error.message : String(error)}`,
          variant: "destructive",
        });
      }
    }
  };

  const downloadImage = (event: MotionEvent) => {
    if (!event.imageUrl) {
      toast({
        title: "Download Failed",
        description: "No image available for this event",
        variant: "destructive"
      });
      return;
    }
    const link = document.createElement('a');
    link.href = event.imageUrl;
    link.download = `motion_${event.cameraName || event.cameraId}_${format(event.timestamp, 'yyyy-MM-dd_HH-mm-ss')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Server now handles sorting, so events are already sorted
  
  // Debug: Log events array
  console.log('=== MOTION EVENTS DEBUG ===');
  console.log('Events array:', events);
  console.log('Events length:', events.length);
  console.log('Events type:', typeof events);
  console.log('First event:', events[0]);
  console.log('Camera filter:', selectedCamera);
  console.log('Search query:', searchQuery);
  console.log('Selected date:', selectedDate);
  console.log('Current page:', currentPage);
  console.log('Total events from API:', totalEvents);
  
  if (events.length > 0) {
    console.log('First event details:', {
      id: events[0].id,
      cameraId: events[0].cameraId,
      cameraName: events[0].cameraName,
      timestamp: events[0].timestamp,
      imageUrl: events[0].imageUrl
    });
  }
  console.log('=== END DEBUG ===');
  
  // Debug: Log events array
  console.log('Events array for rendering:', events);
  console.log('Events length:', events.length);

  // Calculate statistics
  const todayEvents = events.filter(event => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return event.timestamp >= today;
  }).length;

  const highConfidenceEvents = events.filter(event => event.confidence > 0.8).length;
  const uniqueCameras = new Set(events.map(event => event.cameraName)).size;
  const uniqueCameraNames = [...new Set(cameras.map(cam => cam.name))];
  const selectedEvent = selectedEventIndex !== null ? events[selectedEventIndex] : null;

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Motion Events</h1>
          <p className="text-sm text-muted-foreground">
            Review detected motion events from all cameras
          </p>
        </div>
        <Button size="sm" onClick={() => loadEvents()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Compact Stats - Single Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{totalEvents}</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Today</p>
              <p className="text-lg font-bold">{todayEvents}</p>
            </div>
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">High Conf</p>
              <p className="text-lg font-bold">{highConfidenceEvents}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cameras</p>
              <p className="text-lg font-bold">{uniqueCameras}</p>
            </div>
            <CameraIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Compact Filters */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-base">Filters & Search</CardTitle>
          <div className="text-sm text-muted-foreground">
            Showing {events.length} of {totalEvents} events
            {events.length !== totalEvents && (
              <Badge variant="secondary" className="ml-2">Filtered</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="min-w-[140px] h-9">
              <SelectValue placeholder="Camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
              {uniqueCameraNames.map(cameraName => (
                <SelectItem key={cameraName} value={cameraName}>
                  {cameraName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[140px] h-9 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Select value={sortBy} onValueChange={(value: "newest" | "oldest" | "confidence") => setSortBy(value)}>
            <SelectTrigger className="min-w-[110px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="confidence">By Confidence</SelectItem>
            </SelectContent>
          </Select>

          {/* Detection Type Filter */}
          <Select value={selectedDetectionType} onValueChange={setSelectedDetectionType}>
            <SelectTrigger className="min-w-[120px] h-9">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="face">Face Detection</SelectItem>
              <SelectItem value="person">Person Detection</SelectItem>
              <SelectItem value="motion">Motion Only</SelectItem>
            </SelectContent>
          </Select>

          {(searchQuery || selectedCamera !== 'all' || selectedDate) && (
            <Button variant="ghost" size="sm" className="h-9"
              onClick={() => {
                setSearchQuery('');
                setSelectedCamera('all');
                setSelectedDate(undefined);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Events Display - 4x3 Grid */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-[600px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <div className="mt-4 text-muted-foreground">
                Loading events... ({events.length} events loaded)
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <div className="mb-4">
                <p>No motion events found matching your criteria.</p>
                <p className="text-sm">
                  Filter: Camera="{selectedCamera}" | Search="{searchQuery}" | Date="{selectedDate?.toDateString()}"
                </p>
                <p className="text-sm">
                  Total available: {totalEvents} events | Current page: {currentPage}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {events.map((event, index) => (
                <div
                  key={event.id}
                  className="flex flex-col"
                  onClick={() => setSelectedEventIndex(index)}
                >
                  <div className="relative w-full h-48 bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all group">
                    {event.imageUrl ? (
                      <img
                        src={event.imageUrl}
                        alt={`Motion event at ${event.timestamp.toLocaleString()}`}
                        className="object-cover w-full h-full"
                        loading="lazy"
                        onError={(e) => {
                          console.error("Image failed to load:", event.imageUrl, e);
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0MCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNkMxOC40MDMyIDE2IDE3LjE5ODIgMTUuODAzNSAxNS44MDM1IDE1LjgwMzVDMTQuNDA5OCAxNS44MDM1IDE0IDE2LjQwMzUgMTQgMTdDMTQgMTcuNTk2NSAxNC40MDk4IDE4LjE5NjUgMTMuODAzNSAxOC4xOTY1QzEzLjE5NzMgMTguMTk2NSAxMi41OTY1IDE3LjU5NjUgMTIgMTZDMTIgMTQuNDAzNSAxMy4xOTczIDEzLjgwMzUgMTMuODAzNSAxMy44MDM1QzE0LjQwOTggMTMuODAzNSAxNSAxNC40MDM1IDE1IDE2WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                          target.alt = 'Image not available';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <CameraIcon className="h-8 w-8 text-gray-400" />
                        <div className="text-xs text-gray-500 mt-2">{event.cameraName}</div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <CameraIcon className="h-3 w-3" />
                            <span className="text-xs font-medium truncate">{event.cameraName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs">
                              {format(event.timestamp, 'HH:mm:ss')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {event.confidence > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        {formatConfidence(event.confidence)}
                      </div>
                    )}
                    {/* Show badge for face detection events */}
                    {event.labels?.includes('face') && (
                      <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded-full">
                        Face
                      </div>
                    )}
                    {/* Show badge for person detection events */}
                    {event.labels?.includes('person') && !event.labels?.includes('face') && (
                      <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full">
                        Person
                      </div>
                    )}
                  </div>
                  <div className="mt-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 font-mono truncate rounded">
                    {event.imageUrl}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={currentPage === 1 ? undefined : () => handlePageChange(currentPage - 1)} 
                    className={currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}
                  />
                </PaginationItem>
                
                {/* Smart pagination with ellipsis */}
                {(() => {
                  const pages = [];
                  const maxVisible = 7; // Maximum visible pages
                  const halfVisible = Math.floor(maxVisible / 2);
                  
                  if (totalPages <= maxVisible) {
                    // Show all pages if total is less than maxVisible
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    // Show first few pages
                    for (let i = 1; i <= halfVisible; i++) {
                      pages.push(i);
                    }
                    
                    // Add ellipsis if there are pages in between
                    if (currentPage > halfVisible + 2) {
                      pages.push('...');
                    }
                    
                    // Calculate middle pages around current
                    let startPage = Math.max(halfVisible + 1, currentPage - 1);
                    let endPage = Math.min(totalPages - 1, currentPage + 1);
                    
                    // Adjust if near start
                    if (currentPage <= halfVisible + 1) {
                      startPage = halfVisible + 1;
                      endPage = Math.min(totalPages, maxVisible - 2);
                    }
                    
                    // Adjust if near end
                    if (currentPage >= totalPages - halfVisible) {
                      startPage = Math.max(1, totalPages - maxVisible + 3);
                      endPage = totalPages - 1;
                    }
                    
                    // Add middle pages
                    for (let i = startPage; i <= endPage; i++) {
                      if (i > halfVisible && i < totalPages - 1) {
                        pages.push(i);
                      }
                    }
                    
                    // Add ellipsis if there are pages in between at the end
                    if (currentPage < totalPages - halfVisible - 1) {
                      pages.push('...');
                    }
                    
                    // Always show last page
                    pages.push(totalPages);
                  }
                  
                  return pages.map((pageNum, index) => (
                    pageNum === '...' ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">
                          ...
                        </span>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={pageNum}>
                        <PaginationLink 
                          href="#" 
                          isActive={pageNum === currentPage} 
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  ));
                })()}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={currentPage === totalPages ? undefined : () => handlePageChange(currentPage + 1)} 
                    className={currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

      {/* Full Screen Modal with Improved UX */}
      <Dialog open={selectedEventIndex !== null} onOpenChange={() => setSelectedEventIndex(null)}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] p-0 bg-zinc-950 border-zinc-800 rounded-xl overflow-hidden" showClose={false}>
          {selectedEvent && (
            <div className="relative w-full h-[90vh] flex flex-col">
              {/* Header Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-zinc-900/80 to-transparent z-20">
                {/* Left: Event Info */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <CameraIcon className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{selectedEvent.cameraName}</h3>
                      <p className="text-xs text-zinc-400">{format(selectedEvent.timestamp, 'PPP p')}</p>
                    </div>
                  </div>
                  <div className="h-6 w-px bg-zinc-700" />
                  <div className="flex items-center gap-2">
                    {selectedEvent.labels?.map((label) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className={cn(
                          "text-xs px-2 py-0.5",
                          label === 'face' ? "border-blue-500/50 text-blue-400 bg-blue-500/10" :
                          label === 'person' ? "border-green-500/50 text-green-400 bg-green-500/10" :
                          "border-amber-500/50 text-amber-400 bg-amber-500/10"
                        )}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Right: Counter & Actions */}
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-full bg-zinc-800/80 text-xs text-zinc-300 font-medium">
                    {selectedEventIndex + 1} / {events.length}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    onClick={() => downloadImage(selectedEvent)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => handleArchiveEvent(selectedEvent.id)}
                    title="Archive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    onClick={() => setSelectedEventIndex(null)}
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex relative overflow-hidden">
                {/* Left Navigation */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-12 w-12 rounded-full bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/50",
                      "text-zinc-400 hover:text-white hover:bg-zinc-800",
                      selectedEventIndex === 0 && "opacity-30 cursor-not-allowed"
                    )}
                    onClick={() => selectedEventIndex > 0 && setSelectedEventIndex(selectedEventIndex - 1)}
                    disabled={selectedEventIndex === 0}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </div>

                {/* Image Container */}
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="relative max-w-full max-h-full">
                    <img
                      src={selectedEvent.imageUrl || ''}
                      alt={`Motion event at ${format(selectedEvent.timestamp, 'PPP p')}`}
                      className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xl"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />

                    {/* Detection Overlays */}
                    {selectedEvent.detections && selectedEvent.detections.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none">
                        {selectedEvent.detections.map((det, idx) => (
                          <div
                            key={idx}
                            className="absolute border-2 transition-all duration-300"
                            style={{
                              left: `${det.boundingBox.x}px`,
                              top: `${det.boundingBox.y}px`,
                              width: `${det.boundingBox.width}px`,
                              height: `${det.boundingBox.height}px`,
                              borderColor: det.type === 'person' ? '#22c55e' : det.type === 'face' ? '#3b82f6' : '#f59e0b',
                              boxShadow: det.type === 'person' ? '0 0 10px rgba(34, 197, 94, 0.5)' : det.type === 'face' ? '0 0 10px rgba(59, 130, 246, 0.5)' : '0 0 10px rgba(245, 158, 11, 0.5)'
                            }}
                          >
                            <div
                              className="absolute -top-7 left-0 px-2 py-0.5 text-xs font-medium text-white rounded-md whitespace-nowrap"
                              style={{
                                backgroundColor: det.type === 'person' ? '#22c55e' : det.type === 'face' ? '#3b82f6' : '#f59e0b'
                              }}
                            >
                              {det.type === 'person' ? '👤 Person' : det.type === 'face' ? `😐 ${det.name || 'Face'}` : '📦 Object'} • {formatConfidence(det.confidence)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Navigation */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-12 w-12 rounded-full bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/50",
                      "text-zinc-400 hover:text-white hover:bg-zinc-800",
                      selectedEventIndex >= events.length - 1 && "opacity-30 cursor-not-allowed"
                    )}
                    onClick={() => selectedEventIndex < events.length - 1 && setSelectedEventIndex(selectedEventIndex + 1)}
                    disabled={selectedEventIndex >= events.length - 1}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Bottom Panel - Stats Grid */}
              <div className="px-6 py-4 bg-zinc-900/90 border-t border-zinc-800">
                <div className="flex items-start justify-between gap-6">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Confidence</p>
                        <p className="text-sm font-semibold text-white">{formatConfidence(selectedEvent.confidence)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <PersonStanding className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Persons</p>
                        <p className="text-sm font-semibold text-white">{selectedEvent.personCount || 0}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <ScanFace className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Faces</p>
                        <p className="text-sm font-semibold text-white">{selectedEvent.faceCount || 0}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Activity className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Motion Area</p>
                        <p className="text-sm font-semibold text-white">{selectedEvent.motionArea || 0}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Face Recognition Status */}
                  <div className="hidden md:flex items-center gap-4 p-3 rounded-lg bg-zinc-800/50 min-w-[200px]">
                    <div className="flex -space-x-2">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center">
                        <UserX className="h-5 w-5 text-amber-400" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Face Recognition</p>
                      <p className="text-sm font-medium text-white">
                        {selectedEvent.knownFaces || 0} known • {selectedEvent.unknownFaces || 0} unknown
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${((selectedEventIndex + 1) / events.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">
                    {Math.round(((selectedEventIndex + 1) / events.length) * 100)}%
                  </span>
                </div>
              </div>

              {/* Keyboard Hints */}
              <div className="absolute bottom-20 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/50 text-xs text-zinc-400">
                <Keyboard className="h-3 w-3" />
                <span>ESC to close</span>
                <span className="text-zinc-600">•</span>
                <span>← → navigate</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MotionEvents;