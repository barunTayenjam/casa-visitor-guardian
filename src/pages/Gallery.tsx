import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import apiService, { ApiError } from '@/services/ApiService';
import { MotionEvent } from '@/types/security';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Grid3X3,
  List,
  Archive
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

interface DetectionEvent {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName?: string;
  imagePath: string;
  detectionType: 'person' | 'face' | 'object' | 'motion';
  confidence: number;
  labels?: string[];
}

const Gallery = () => {
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getHistoricalEvents({
        page: currentPage,
        pageSize: viewMode === 'grid' ? 12 : 20,
        cameraId: selectedCamera === 'all' ? undefined : selectedCamera,
        searchQuery: searchQuery || undefined,
        startDate: selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0) : undefined,
        endDate: selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999) : undefined,
        sortBy: sortBy,
        detectionType: selectedDetectionType
      });
      setEvents(response.events);
      setTotalPages(response.pagination.totalPages);
      setTotalEvents(response.pagination.totalEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast({
        title: 'Error',
        description: `Failed to load events: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: 'destructive',
      });
      setEvents([]);
      setTotalPages(1);
      setTotalEvents(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCamera, searchQuery, selectedDate, sortBy, toast, selectedDetectionType, viewMode]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

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

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventIndex, events.length]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedEventIndex(null);
  };

  const handleArchiveEvent = async (eventId: string) => {
    try {
      await apiService.archiveEvent(eventId);
      toast({
        title: "Event Archived",
        description: "The event has been archived.",
      });
      loadEvents();
      setSelectedEventIndex(null);
    } catch (error) {
      console.error(`Failed to archive event ${eventId}:`, error);
      toast({
        title: "Error",
        description: `Failed to archive event: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: "destructive",
      });
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
    link.download = `event_${event.cameraName || event.cameraId}_${format(event.timestamp, 'yyyy-MM-dd_HH-mm-ss')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Detection Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Unified view of all motion events, object detections, and face recognition results
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => loadEvents()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex border rounded-md">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

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

          <Select value={selectedDetectionType} onValueChange={(value: "all" | "face" | "person" | "motion") => setSelectedDetectionType(value)}>
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

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-[600px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <div className="ml-4 text-muted-foreground">
                Loading events... ({events.length} events loaded)
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <div className="mb-4">
                <p>No events found matching your criteria.</p>
                <p className="text-sm">
                  Filter: Camera="{selectedCamera}" | Search="{searchQuery}" | Date="{selectedDate?.toDateString()}"
                </p>
                <p className="text-sm">
                  Total available: {totalEvents} events | Current page: {currentPage}
                </p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
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
                        alt={`Event at ${event.timestamp.toLocaleString()}`}
                        className="object-cover w-full h-full"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0MCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNkMxOC40MDMyIDE2IDE3LjE5ODIgMTUuODAzNSAxNS44MDM1IDE1LjgwMzVDMTQuNDA5OCAxNS44MDM1IDE0IDE2LjQwMzUgMTQgMTdDMTQgMTcuNTk2NSAxNC40MDk4IDE4LjE5NjUgMTMuODAzNSAxOC4xOTY1QzEzLjE5NzMgMTguMTk2NSAxMi41OTY1IDE3LjU5NjUgMTIgMTZDMTIgMTQuNDAzNSAxMy4xOTczIDEzLjgwMzUgMTMuODAzNSAxMy44MDM1QzE0LjQwOTggMTMuODAzNSAxNSAxNC40MDM1IDE1IDE2WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
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
                      <div className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded-full">
                        {event.confidence >= 1 ? Math.round(event.confidence) + '%' : Math.round(event.confidence * 100) + '%'}
                      </div>
                    )}
                    {event.labels?.includes('face') && (
                      <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded-full">
                        Face
                      </div>
                    )}
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
          ) : (
            <div className="space-y-2">
              {events.map((event, index) => (
                <div
                  key={event.id}
                  className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEventIndex(index)}
                >
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-24 h-16 bg-gray-200 rounded overflow-hidden">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={`Event at ${event.timestamp.toLocaleString()}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CameraIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-1 truncate w-24">
                      {event.imageUrl}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{event.cameraName}</span>
                      <Badge variant="outline" className="text-xs">
                        {format(event.timestamp, 'HH:mm:ss')}
                      </Badge>
                      {event.labels?.map((label) => (
                        <Badge key={label} variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(event.timestamp, 'PPP p')}
                    </div>
                  </div>
                  {event.confidence > 0 && (
                    <div className="text-sm font-medium">
                      {event.confidence >= 1 ? Math.round(event.confidence) + '%' : Math.round(event.confidence * 100) + '%'}
                    </div>
                  )}
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
                
                {(() => {
                  const pages = [];
                  const maxVisible = 7;
                  const halfVisible = Math.floor(maxVisible / 2);
                  
                  if (totalPages <= maxVisible) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    for (let i = 1; i <= halfVisible; i++) {
                      pages.push(i);
                    }
                    
                    if (currentPage > halfVisible + 2) {
                      pages.push('...');
                    }
                    
                    let startPage = Math.max(halfVisible + 1, currentPage - 1);
                    let endPage = Math.min(totalPages - 1, currentPage + 1);
                    
                    if (currentPage <= halfVisible + 1) {
                      startPage = halfVisible + 1;
                      endPage = Math.min(totalPages, maxVisible - 2);
                    }
                    
                    if (currentPage >= totalPages - halfVisible) {
                      startPage = Math.max(1, totalPages - maxVisible + 3);
                      endPage = totalPages - 1;
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      if (i > halfVisible && i < totalPages - 1) {
                        pages.push(i);
                      }
                    }
                    
                    if (currentPage < totalPages - halfVisible - 1) {
                      pages.push('...');
                    }
                    
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
                          onClick={() => handlePageChange(pageNum as number)}
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

      <Dialog open={selectedEventIndex !== null} onOpenChange={() => setSelectedEventIndex(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black border-none">
          {selectedEvent && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 z-10 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setSelectedEventIndex(null)}
              >
                <X className="h-4 w-4" />
              </Button>

              {selectedEventIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setSelectedEventIndex(selectedEventIndex - 1)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}

              {selectedEventIndex < events.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setSelectedEventIndex(selectedEventIndex + 1)}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}

              <img
                src={selectedEvent.imageUrl || ''}
                alt={`Event at ${selectedEvent.timestamp.toLocaleString()}`}
                className="max-w-full max-h-full object-contain"
              />

              <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{selectedEvent.cameraName}</h3>
                    <p className="text-sm text-white/80">
                      {selectedEvent.timestamp.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      Event {selectedEventIndex + 1} of {events.length} • {selectedEvent.confidence >= 1 ? Math.round(selectedEvent.confidence) + '%' : Math.round(selectedEvent.confidence * 100) + '%'} confidence
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-white/20"
                      onClick={() => downloadImage(selectedEvent)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-white/20 text-red-400"
                      onClick={() => handleArchiveEvent(selectedEvent.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg text-xs">
                <div>← → Navigate</div>
                <div>ESC Close</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gallery;