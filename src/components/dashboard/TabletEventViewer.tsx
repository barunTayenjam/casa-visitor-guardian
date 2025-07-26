import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera as CameraIcon, Clock, Filter, Calendar, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MotionEvent } from '@/types/security';
import { useEvents } from '@/contexts/EventsContext';
import { cn } from '@/lib/utils';

interface TabletEventViewerProps {
  onEventSelect?: (event: MotionEvent) => void;
}

type FilterType = 'all' | 'today' | 'week' | 'month';

const filterOptions = [
  { value: 'all' as FilterType, label: 'All Events', days: null },
  { value: 'today' as FilterType, label: 'Today', days: 1 },
  { value: 'week' as FilterType, label: 'This Week', days: 7 },
  { value: 'month' as FilterType, label: 'This Month', days: 30 },
];

export const TabletEventViewer = ({ onEventSelect }: TabletEventViewerProps) => {
  const { events, loading, error, loadMoreEvents, hasMore } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const observerRef = useRef<IntersectionObserver>();
  const loadingRef = useRef<HTMLDivElement>(null);

  // Filter events based on selected filter
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    
    const now = new Date();
    const eventDate = new Date(event.timestamp);
    const filterOption = filterOptions.find(opt => opt.value === filter);
    
    if (!filterOption?.days) return true;
    
    const cutoffDate = new Date(now.getTime() - (filterOption.days * 24 * 60 * 60 * 1000));
    return eventDate >= cutoffDate;
  });

  // Infinite scroll implementation
  const lastEventElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreEvents();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore, loadMoreEvents]);

  const handleEventClick = (event: MotionEvent) => {
    setSelectedEvent(event);
    onEventSelect?.(event);
  };

  const getFilterBadgeCount = (filterType: FilterType) => {
    if (filterType === 'all') return events.length;
    
    const now = new Date();
    const filterOption = filterOptions.find(opt => opt.value === filterType);
    if (!filterOption?.days) return 0;
    
    const cutoffDate = new Date(now.getTime() - (filterOption.days * 24 * 60 * 60 * 1000));
    return events.filter(event => new Date(event.timestamp) >= cutoffDate).length;
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-12 text-center max-w-md">
          <CameraIcon className="h-16 w-16 text-muted-foreground animate-pulse mx-auto mb-6" />
          <h3 className="text-2xl font-medium mb-4">Loading Events...</h3>
          <p className="text-lg text-muted-foreground">
            Please wait while we load your motion events.
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="p-12 text-center max-w-md">
          <CameraIcon className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-2xl font-medium text-red-600 mb-4">Error Loading Events</h3>
          <p className="text-lg text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col">
        {/* Filter Bar */}
        <div className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Motion Events</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" className="h-12 px-6">
                  <Filter className="h-5 w-5 mr-2" />
                  {filterOptions.find(opt => opt.value === filter)?.label}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {filterOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className="flex items-center justify-between"
                  >
                    <span>{option.label}</span>
                    <Badge variant="secondary" className="ml-2">
                      {getFilterBadgeCount(option.value)}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex gap-3">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "outline"}
                size="lg"
                onClick={() => setFilter(option.value)}
                className="h-12 px-6"
              >
                {option.label}
                <Badge 
                  variant={filter === option.value ? "secondary" : "default"} 
                  className="ml-2"
                >
                  {getFilterBadgeCount(option.value)}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        <div className="flex-1 p-6 overflow-auto">
          {filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Card className="p-12 text-center max-w-md">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-2xl font-medium mb-4">No Events Found</h3>
                <p className="text-lg text-muted-foreground">
                  No motion events found for the selected time period.
                </p>
              </Card>
            </div>
          ) : (
            <div 
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              }}
            >
              {filteredEvents.map((event, index) => (
                <Card
                  key={event.id}
                  ref={index === filteredEvents.length - 1 ? lastEventElementRef : null}
                  className="overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="relative aspect-video bg-muted">
                    {event.imageUrl ? (
                      <img
                        src={event.imageUrl}
                        alt={`Motion event at ${event.timestamp.toLocaleString()}`}
                        className="object-cover w-full h-full"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = '/placeholder-camera.jpg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CameraIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* Event Info Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-center justify-between text-white mb-2">
                          <div className="flex items-center gap-2">
                            <CameraIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">{event.cameraName}</span>
                          </div>
                          {event.confidence > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(event.confidence * 100)}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-white/90">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm">
                            {event.timestamp.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="lg" variant="secondary" className="h-12 px-6">
                        View Full Size
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div ref={loadingRef} className="flex justify-center py-8">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-lg">Loading more events...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Event Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 border-0">
          {selectedEvent && (
            <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
              {selectedEvent.imageUrl ? (
                <img
                  src={selectedEvent.imageUrl}
                  alt={`Motion event at ${selectedEvent.timestamp.toLocaleString()}`}
                  className="object-contain w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <CameraIcon className="h-24 w-24 text-muted-foreground" />
                </div>
              )}

              {/* Event Details Overlay */}
              <div className="absolute top-6 left-6 bg-black/70 backdrop-blur-sm text-white px-6 py-4 rounded-lg">
                <h2 className="text-2xl font-bold mb-2">{selectedEvent.cameraName}</h2>
                <div className="flex items-center gap-4 text-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <span>{selectedEvent.timestamp.toLocaleString()}</span>
                  </div>
                  {selectedEvent.confidence > 0 && (
                    <Badge variant="secondary" className="text-sm">
                      {Math.round(selectedEvent.confidence * 100)}% confidence
                    </Badge>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="absolute bottom-6 right-6">
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="h-14 px-8"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};