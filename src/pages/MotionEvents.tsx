import React, { useState } from 'react';
import { EventViewer } from '@/components/dashboard/EventViewer';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import apiService from '@/services/ApiService';
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
  Filter, 
  Calendar as CalendarIcon,
  Camera as CameraIcon,
  TrendingUp,
  AlertTriangle,
  RefreshCw
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

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadEvents = React.useCallback(async () => {
      console.log('Loading events for MotionEvents page...');
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

  // Filter and sort events
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.cameraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.labels.some(label => label.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCamera = selectedCamera === 'all' || event.cameraName === selectedCamera;
    
    const matchesDate = !selectedDate || 
                       event.timestamp.toDateString() === selectedDate.toDateString();
    
    return matchesSearch && matchesCamera && matchesDate;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
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
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{events.length}</p>
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
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cameras</SelectItem>
                {cameras.map(camera => (
                  <SelectItem key={camera.id} value={camera.name}>
                    {camera.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[180px] justify-start text-left font-normal',
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
              <SelectTrigger className="w-[140px]">
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
            <span>Showing {sortedEvents.length} of {events.length} events</span>
            {filteredEvents.length !== events.length && (
              <Badge variant="secondary">Filtered</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events Display */}
      {loading ? (
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <EventViewer 
          events={sortedEvents}
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
