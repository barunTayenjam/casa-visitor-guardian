import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { MotionEvent } from '@/types/security';
import { EventTimeline } from '@/components/events/EventTimeline';
import { SmartFilters, FilterState } from '@/components/events/SmartFilters';
import { EventDetailPanel } from '@/components/events/EventDetailPanel';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { Calendar, TrendingUp, AlertTriangle, Clock, User } from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import apiService from '@/services/ApiService';
import { useNavigate } from 'react-router-dom';

const EventsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cameras } = useCameras();
  
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    cameraId: 'all',
    detectionType: 'all',
    dateRange: { start: undefined, end: undefined },
    confidence: 'all',
  });

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;
  const cameraNames = cameras.map(c => c.name);

  // Load events
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getEnhancedEventsList({
        page: 1,
        pageSize: 100,
        camera_id: filters.cameraId === 'all' ? undefined : filters.cameraId,
        start_date: filters.dateRange.start?.toISOString(),
        end_date: filters.dateRange.end?.toISOString(),
        event_type: filters.detectionType === 'all' ? undefined : filters.detectionType,
        searchQuery: filters.searchQuery || undefined,
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
  }, [filters, toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Handle event selection
  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  // Handle event delete
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

  // Handle event download
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

  // Navigate events
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

  // Calculate stats
  const stats = {
    total: events.length,
    today: events.filter(e => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return e.timestamp >= today;
    }).length,
    highConfidence: events.filter(e => e.confidence > 0.8).length,
  };

  return (
    <div className="w-full min-h-screen flex flex-col" style={{ backgroundColor: colors.background.primary }}>
      {/* Top Navigation */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b flex items-center justify-between" style={{ backgroundColor: colors.glass.light, backdropFilter: 'blur(10px)', borderColor: colors.border.subtle }}>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.interactive.hover }}>
              <Calendar className="h-4 w-4 md:h-5 md:w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-white">Events</h1>
              <p className="text-xs text-white/60 hidden sm:block">Browse motion events</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80 hidden md:inline">{stats.total} total</span>
              <span className="text-sm text-white/80 md:hidden">{stats.total}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80 hidden md:inline">{stats.today} today</span>
              <span className="text-sm text-white/80 md:hidden">{stats.today}</span>
            </div>
          </div>
        </div>

        <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5" onClick={() => navigate('/app')}>
          Back
        </Button>
      </div>

      {/* Filters */}
      <SmartFilters
        cameras={cameraNames}
        onFiltersChange={setFilters}
      />

      {/* Timeline */}
      <EventTimeline
        events={filteredEvents}
        selectedEventId={selectedEventId || undefined}
        onEventSelect={handleEventSelect}
      />

       {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Events Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video bg-slate-800 rounded-t-lg" />
                  <div className="p-3 bg-slate-900/50 rounded-b-lg">
                    <div className="h-4 bg-slate-700 rounded mb-2" />
                    <div className="h-3 bg-slate-800 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-white/20" />
                <h3 className="text-lg font-semibold text-white mb-2">No Events Found</h3>
                <p className="text-sm text-white/50">Try adjusting your filters or check back later</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    'relative rounded-xl overflow-hidden cursor-pointer',
                    'transition-all duration-300 ease-out',
                    'animate-slide-up',
                    'hover:shadow-2xl hover:scale-[1.02]',
                    'hover:ring-2 hover:ring-white/20',
                    selectedEventId === event.id && 'ring-2 ring-blue-500 shadow-xl',
                    'group'
                  )}
                  style={{
                    backgroundColor: colors.background.tertiary,
                    animationDelay: `${index * 50}ms`,
                  }}
                  onClick={() => handleEventSelect(event.id)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black overflow-hidden">
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

                    {/* Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Detection Badge */}
                    {event.labels && event.labels.length > 0 && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="px-2 py-1 rounded-md text-[10px] md:text-xs font-semibold text-white backdrop-blur-sm" style={{ backgroundColor: `${colors.detection[event.labels[0] as keyof typeof colors.detection] || colors.detection.motion}DD` }}>
                          {event.labels[0]}
                        </div>
                      </div>
                    )}

                    {/* Confidence Badge */}
                    {event.confidence > 0 && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="px-2 py-1 rounded-md text-[10px] md:text-xs font-semibold bg-black/70 backdrop-blur-sm text-white">
                          {Math.round(event.confidence * 100)}%
                        </div>
                      </div>
                    )}

                    {/* Person/Face Count - Bottom Left */}
                    {(event.personCount > 0 || event.faceCount > 0) && (
                      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {event.personCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] md:text-xs">
                            <User className="h-3 w-3" />
                            <span>{event.personCount}</span>
                          </div>
                        )}
                        {event.faceCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] md:text-xs">
                            <span>👤 {event.faceCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-3 bg-slate-900/80 backdrop-blur-sm">
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
          )}
        </div>

        {/* Detail Panel */}
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

            {/* Related Events - Below Detail Panel */}
            <div className="w-full md:w-[600px] lg:w-[700px] border-t overflow-y-auto" style={{ borderColor: colors.border.subtle }}>
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
