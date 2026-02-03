import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { MotionEvent } from '@/types/security';
import { EventTimeline } from '@/components/events/EventTimeline';
import { SmartFilters, FilterState } from '@/components/events/SmartFilters';
import { EventDetailPanel } from '@/components/events/EventDetailPanel';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { Calendar, TrendingUp, AlertTriangle, Clock, User, Grid, List, ChevronLeft, Archive, Download } from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import apiService from '@/services/ApiService';
import { useNavigate } from 'react-router-dom';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'confidence';

const EventsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cameras } = useCameras();
  
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    cameraId: 'all',
    detectionType: 'all',
    dateRange: { start: undefined, end: undefined },
    confidence: 'all',
  });

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;
  const cameraNames = cameras.map(c => c.name);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const pageSize = viewMode === 'grid' ? 24 : 50;
      const response = await apiService.getEnhancedEventsList({
        page: currentPage,
        pageSize: pageSize,
        camera_id: filters.cameraId === 'all' ? undefined : filters.cameraId,
        start_date: filters.dateRange.start?.toISOString(),
        end_date: filters.dateRange.end?.toISOString(),
        event_type: filters.detectionType === 'all' ? undefined : filters.detectionType,
        searchQuery: filters.searchQuery || undefined,
        sortBy: sortBy,
      });

      const transformedEvents = response.events.map((event: any): MotionEvent => ({
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
        detections: [],
        personCount: event.persons_detected || 0,
        faceCount: event.faces_detected || 0,
        knownFaces: event.known_faces_count || 0,
        unknownFaces: event.unknown_faces_count || 0,
      }));

      setEvents(transformedEvents);
      setFilteredEvents(transformedEvents);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalEvents(response.pagination.totalEvents);
      }
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
  }, [filters, toast, currentPage, viewMode, sortBy]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleEventDelete = async (eventId: string) => {
    try {
      await apiService.archiveEvent(eventId);
      toast({
        title: 'Event Deleted',
        description: 'The event has been deleted.',
      });
      setSelectedEventId(null);
      loadEvents();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
    }
  };

  const handleEventDownload = (event: MotionEvent) => {
    if (event.imageUrl) {
      const link = document.createElement('a');
      link.href = event.imageUrl;
      link.download = `event_${event.cameraId}.jpg`;
      link.click();
      toast({
        title: 'Downloaded',
        description: 'Event image has been downloaded.',
      });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedEventId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const goToNextEvent = () => {
    if (!selectedEvent) return;
    const currentIndex = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (currentIndex < filteredEvents.length - 1) {
      setSelectedEventId(filteredEvents[currentIndex + 1].id);
    }
  };

  const goToPreviousEvent = () => {
    if (!selectedEvent) return;
    const currentIndex = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (currentIndex > 0) {
      setSelectedEventId(filteredEvents[currentIndex - 1].id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedEventId) return;
      
      if (e.key === 'Escape') {
        setSelectedEventId(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousEvent();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextEvent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, filteredEvents, selectedEvent]);

  const stats = {
    total: totalEvents,
    today: events.filter(e => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return e.timestamp >= today;
    }).length,
    highConfidence: events.filter(e => e.confidence > 0.8).length,
  };

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ backgroundColor: colors.background.primary }}>
      <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center gap-4 md:gap-6">
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5" onClick={() => navigate('/app/streams')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colors.status.info}15` }}>
              <Calendar className="h-5 w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Events</h1>
              <p className="text-xs text-white/50 hidden sm:block">Browse and manage security events</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.status.info }} />
              <span className="text-sm text-white/70">{stats.total} total</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.status.warning }} />
              <span className="text-sm text-white/70">{stats.today} today</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[140px] h-8 bg-white/5 border-white/10 text-white/70 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="confidence">By Confidence</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded transition-all',
                viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
              )}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded transition-all',
                viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <SmartFilters cameras={cameraNames} onFiltersChange={setFilters} />

      {viewMode === 'grid' && (
        <EventTimeline
          events={filteredEvents}
          selectedEventId={selectedEventId || undefined}
          onEventSelect={handleEventSelect}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className={cn(
              viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'space-y-3',
              'gap-4'
            )}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video bg-slate-800 rounded-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${colors.status.warning}15` }}>
                  <Calendar className="h-8 w-8" style={{ color: colors.status.warning }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Events Found</h3>
                <p className="text-sm text-white/50">Try adjusting your filters or check back later</p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    'relative rounded-xl overflow-hidden cursor-pointer',
                    'transition-all duration-300',
                    'hover:shadow-xl hover:scale-[1.02]',
                    'hover:ring-2 hover:ring-white/20',
                    selectedEventId === event.id && 'ring-2 ring-blue-500 shadow-xl',
                    'group'
                  )}
                  style={{
                    backgroundColor: colors.background.secondary,
                    animationDelay: `${index * 30}ms`,
                  }}
                  onClick={() => handleEventSelect(event.id)}
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {event.imageUrl ? (
                      <img
                        src={event.imageUrl}
                        alt={event.cameraName}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-white/30">No image</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {event.labels && event.labels.length > 0 && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="px-2 py-1 rounded-lg text-xs font-semibold text-white backdrop-blur-md" style={{ backgroundColor: `${colors.detection[event.labels[0] as keyof typeof colors.detection] || colors.detection.motion}DD` }}>
                          {event.labels[0]}
                        </div>
                      </div>
                    )}
                    {event.confidence > 0 && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="px-2 py-1 rounded-lg text-xs font-semibold bg-black/70 backdrop-blur-md text-white">
                          {Math.round(event.confidence * 100)}%
                        </div>
                      </div>
                    )}
                    {(event.personCount > 0 || event.faceCount > 0) && (
                      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {event.personCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs">
                            <User className="h-3 w-3" />
                            <span>{event.personCount}</span>
                          </div>
                        )}
                        {event.faceCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs">
                            <span>👤 {event.faceCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {event.cameraName}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-white/50">
                          <Clock className="h-3 w-3" />
                          <span className="truncate">{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-xl cursor-pointer',
                    'transition-all duration-300',
                    'hover:shadow-lg hover:scale-[1.01]',
                    'hover:ring-2 hover:ring-white/10',
                    selectedEventId === event.id && 'ring-2 ring-blue-500 shadow-lg bg-blue-500/5',
                    'group'
                  )}
                  style={{
                    backgroundColor: colors.background.secondary,
                  }}
                  onClick={() => handleEventSelect(event.id)}
                >
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                    {event.imageUrl ? (
                      <img
                        src={event.imageUrl}
                        alt={event.cameraName}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-white/30">No image</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                        {event.cameraName}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {event.labels && event.labels.length > 0 && (
                          <div className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: `${colors.detection[event.labels[0] as keyof typeof colors.detection] || colors.detection.motion}DD` }}>
                            {event.labels[0]}
                          </div>
                        )}
                        {event.confidence > 0 && (
                          <div className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/70">
                            {Math.round(event.confidence * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                      </div>
                      {event.personCount > 0 && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{event.personCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={currentPage === 1 ? undefined : () => handlePageChange(currentPage - 1)}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {(() => {
                    const pages = [];
                    const maxVisible = 5;
                    
                    if (totalPages <= maxVisible) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      if (currentPage <= 3) {
                        for (let i = 1; i <= 4; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      } else if (currentPage >= totalPages - 2) {
                        pages.push(1);
                        pages.push('...');
                        for (let i = totalPages - 3; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        pages.push(1);
                        pages.push('...');
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      }
                    }
                    
                    return pages.map((pageNum, index) => (
                      pageNum === '...' ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <span className="flex h-9 w-9 items-center justify-center text-white/50">...</span>
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={pageNum}>
                          <PaginationLink 
                            onClick={() => handlePageChange(pageNum as number)}
                            isActive={pageNum === currentPage}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    ));
                  })()}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={currentPage === totalPages ? undefined : () => handlePageChange(currentPage + 1)}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
               </Pagination>
             </div>
           )}
         </div>

         {selectedEvent && (
          <>
            <EventDetailPanel
              event={selectedEvent}
              events={filteredEvents}
              onClose={() => setSelectedEventId(null)}
              onNext={goToNextEvent}
              onPrevious={goToPreviousEvent}
              onDelete={handleEventDelete}
              onDownload={handleEventDownload}
            />
            <div className="w-full md:w-[500px] lg:w-[600px] border-t overflow-y-auto" style={{ borderColor: colors.border.subtle }}>
              <RelatedEvents
                currentEvent={selectedEvent}
                events={filteredEvents}
                onEventSelect={handleEventSelect}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
