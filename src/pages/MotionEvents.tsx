import React, { useState, useEffect, useCallback } from 'react';
import { EventGrid } from '@/components/dashboard/EventGrid';
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
  ScanSearch // Added for the new button
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


const MotionEvents = () => {
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [scanning, setScanning] = useState(false); // New state for scanning

  const loadEvents = useCallback(async () => {
    console.log('Loading events for MotionEvents page...');
    setLoading(true);
    try {
      const response = await apiService.getHistoricalEvents({
        page: currentPage,
        pageSize: 20, // Increased to show more events
        cameraId: selectedCamera === 'all' ? undefined : selectedCamera,
        searchQuery: searchQuery || undefined,
        startDate: selectedDate || undefined,
        endDate: selectedDate ? new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined, // End of selected day
      });
      console.log("Fetched motion events:", response.events); // Add logging
      setEvents(response.events);
      setTotalPages(response.pagination.totalPages);
      setTotalEvents(response.pagination.totalEvents);
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
  }, [currentPage, selectedCamera, searchQuery, selectedDate, toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleArchiveEvent = async (eventId: string) => {
    if (window.confirm("Are you sure you want to archive this event?")) {
      try {
        await apiService.archiveEvent(eventId);
        toast({
          title: "Event Archived",
          description: "The motion event has been archived.",
        });
        loadEvents(); // Refresh the list after archiving
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

  const handleScanSnapshots = async () => {
    setScanning(true);
    try {
      await apiService.scanSnapshotsForPersons();
      toast({
        title: "Scan Initiated",
        description: "Scanning of past snapshots for persons has been initiated.",
      });
    } catch (error) {
      console.error('Failed to scan snapshots for persons:', error);
      toast({
        title: "Error",
        description: `Failed to scan snapshots for persons: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  // Filter and sort events (now done by backend, but keeping for client-side if needed)
  const sortedEvents = [...events].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.timestamp.getTime() - a.timestamp.getTime();
      case 'oldest':
        return a.timestamp.getTime() - b.timestamp.getTime();
      case 'confidence':
        return b.confidence - a.confidence;
      default:
        return 0;
    }
  });

  // Calculate statistics
  const todayEvents = events.filter(event => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return event.timestamp >= today;
  }).length;

  const highConfidenceEvents = events.filter(event => event.confidence > 0.8).length;
  const uniqueCameras = new Set(events.map(event => event.cameraName)).size;

  const uniqueCameraNames = [...new Set(cameras.map(cam => cam.name))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Motion Events</h1>
          <p className="text-muted-foreground mt-2">
            Review and analyze detected motion events from all cameras
          </p>
        </div>
        <Button onClick={() => loadEvents()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button onClick={handleScanSnapshots} disabled={scanning || loading}>
          <ScanSearch className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan Snapshots for Persons'}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{totalEvents}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{todayEvents}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Confidence</p>
                <p className="text-2xl font-bold">{highConfidenceEvents}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Cameras</p>
                <p className="text-2xl font-bold">{uniqueCameras}</p>
              </div>
              <CameraIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="Select camera" />
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
                <Button
                  variant="outline"
                  className={cn(
                    'min-w-[160px] justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
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

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="min-w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="confidence">By Confidence</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || selectedCamera !== 'all' || selectedDate) && (
              <Button
                variant="ghost"
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
          
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing {events.length} of {totalEvents} events</span>
            {events.length !== totalEvents && (
              <Badge variant="secondary">Filtered</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events Display */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No motion events found matching your criteria.
            </div>
          ) : (
            <EventGrid 
              events={sortedEvents}
              onImageClick={(event) => {
                console.log("Image clicked for event:", event.id, "URL:", event.imageUrl); // Added log
                setSelectedEvent(event);
              }}
            />
          )}

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                </PaginationItem>
                {[...Array(totalPages)].map((_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink href="#" isActive={index + 1 === currentPage} onClick={() => handlePageChange(index + 1)}>
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>

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
                  src={selectedEvent.imageUrl || ''}
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
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-white/20"
                        onClick={() => selectedEvent && downloadImage(selectedEvent)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-white/20 text-red-400"
                        onClick={() => selectedEvent && handleArchiveEvent(selectedEvent.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
