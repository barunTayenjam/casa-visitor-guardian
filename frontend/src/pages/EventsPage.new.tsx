import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { MotionEvent } from '@/types/security';
import { EventTimeline } from '@/components/events/EventTimeline';
import { SmartFilters, FilterState } from '@/components/events/SmartFilters';
import { EventDetailPanel } from '@/components/events/EventDetailPanel';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
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
    <div
      className="w-full h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.background.primary }}
    >
      {/* Top Navigation */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{
          backgroundColor: colors.glass.light,
          backdropFilter: 'blur(10px)',
          borderColor: colors.border.subtle,
        }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.interactive.hover }}
            >
              <Calendar className="h-5 w-5" style={{ color: colors.status.info }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Events</h1>
              <p className="text-xs text-white/60">Browse motion events</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80">{stats.total} total</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/80">{stats.today} today</span>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/5"
          onClick={() => navigate('/app')}
        >
          Back to Streams
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4" />
                <p className="text-white/60">Loading events...</p>
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-white/20" />
                <h3 className="text-lg font-semibold text-white mb-2">No Events Found</h3>
                <p className="text-sm text-white/50">
                  Try adjusting your filters or check back later
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    'relative rounded-lg overflow-hidden cursor-pointer transition-all',
                    'hover:scale-105 hover:shadow-lg',
                    selectedEventId === event.id && 'ring-2 ring-blue-500'
                  )}
                  style={{ backgroundColor: colors.background.tertiary }}
                  onClick={() => handleEventSelect(event.id)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black">
                    {event.imageUrl ? (
                      <img
                        src={event.imageUrl}
                        alt={event.cameraName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-white/30">No image</p>
                      </div>
                    )}

                    {/* Detection Badge */}
                    {event.labels && event.labels.length > 0 && (
                      <div className="absolute top-2 left-2">
                        <div
                          className="px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                          style={{
                            backgroundColor: `${colors.detection[event.labels[0] as keyof typeof colors.detection] || colors.detection.motion}CC`,
                          }}
                        >
                          {event.labels[0]}
                        </div>
                      </div>
                    )}

                    {/* Confidence Badge */}
                    {event.confidence > 0 && (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white">
                        {Math.round(event.confidence * 100)}%
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-white truncate">
                      {event.cameraName}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
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
