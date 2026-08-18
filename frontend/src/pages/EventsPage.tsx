import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { MotionEvent } from '@/types/security';
import { SmartFilters, FilterState } from '@/components/events/SmartFilters';
import { EventDetailPanel } from '@/components/events/EventDetailPanel';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { eventService } from '@/services/api/eventService';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationNext,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortOption = 'newest' | 'oldest' | 'confidence';

function getFilterFromParams(params: URLSearchParams): FilterState {
  return {
    cameraId: params.get('cameraId') || 'all',
    detectionType: (params.get('detectionType') || 'person') as FilterState['detectionType'],
    quickRange: (params.get('quickRange') || 'all') as FilterState['quickRange'],
    dateRange: {
      start: params.get('startDate') ? new Date(params.get('startDate')!) : undefined,
      end: params.get('endDate') ? new Date(params.get('endDate')!) : undefined,
    },
  };
}

const PERSON_CONFIDENCE_FLOOR = 0.55;

const EventsPage = () => {
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const sortBy = (searchParams.get('sortBy') || 'newest') as SortOption;
  const selectedEventId = searchParams.get('eventId');
  const filters = useMemo(() => getFilterFromParams(searchParams), [searchParams]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await eventService.getEnhancedEventsList({
        page: currentPage,
        pageSize: 12,
        camera_id: filters.cameraId === 'all' ? undefined : filters.cameraId,
        event_type: filters.detectionType === 'all' ? undefined : filters.detectionType,
        min_confidence: filters.detectionType === 'person' ? PERSON_CONFIDENCE_FLOOR : undefined,
        start_date: filters.dateRange.start?.toISOString(),
        end_date: filters.dateRange.end?.toISOString(),
        sortBy,
      });

      setEvents(
        response.events.map((event): MotionEvent => ({
          id: event.id,
          cameraId: event.cameraId,
          cameraName: event.cameraName || `Camera ${event.cameraId}`,
          timestamp: new Date(event.timestamp),
          imageUrl: event.imageUrl || null,
          confidence: event.confidence,
          labels: event.labels || [event.event_type || 'motion'],
          location: event.cameraName || '',
          duration: 0,
          archived: false,
          metadata: event.metadata,
          detections: [],
          personCount: event.persons_detected,
          faceCount: event.faces_detected,
          knownFaces: event.known_faces_count,
          unknownFaces: event.unknown_faces_count,
          severity: event.severity,
        })),
      );

      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load events', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, sortBy, toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleFiltersChange = useCallback(
    (f: FilterState) => {
      updateParams({
        cameraId: f.cameraId !== 'all' ? f.cameraId : null,
        detectionType: f.detectionType !== 'all' ? f.detectionType : null,
        quickRange: f.quickRange !== 'all' ? f.quickRange : null,
        startDate: f.quickRange === 'all' && f.dateRange.start ? f.dateRange.start.toISOString() : null,
        endDate: f.quickRange === 'all' && f.dateRange.end ? f.dateRange.end.toISOString() : null,
        page: null,
        eventId: null,
      });
    },
    [updateParams],
  );

  const handleSortChange = useCallback(
    (value: SortOption) => {
      updateParams({ sortBy: value !== 'newest' ? value : null, page: null });
    },
    [updateParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page: page > 1 ? String(page) : null, eventId: null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [updateParams],
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  const handleEventSelect = useCallback(
    (eventId: string) => {
      updateParams({ eventId: eventId === selectedEventId ? null : eventId });
    },
    [updateParams, selectedEventId],
  );

  const goToSibling = useCallback(
    (direction: 1 | -1) => {
      if (!selectedEvent) return;
      const idx = events.findIndex((e) => e.id === selectedEvent.id);
      const next = events[idx + direction];
      if (next) updateParams({ eventId: next.id });
    },
    [selectedEvent, events, updateParams],
  );

  const handleEventDelete = useCallback(
    async (eventId: string) => {
      try {
        await eventService.archiveEvent(eventId);
        toast({ title: 'Event Deleted', description: 'The event has been deleted.' });
        updateParams({ eventId: null });
        loadEvents();
      } catch {
        toast({ title: 'Error', description: 'Failed to delete event', variant: 'destructive' });
      }
    },
    [toast, updateParams, loadEvents],
  );

  const handleEventDownload = useCallback((event: MotionEvent) => {
    if (!event.imageUrl) return;
    const link = document.createElement('a');
    link.href = event.imageUrl;
    link.download = `event_${event.cameraId}.jpg`;
    link.click();
  }, []);

  const cameraList = cameras.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="w-full min-h-[100dvh] flex flex-col">
      <div className="px-5 pt-6 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <Select value={sortBy} onValueChange={(value: SortOption) => handleSortChange(value)}>
          <SelectTrigger className="w-[130px] h-9 rounded-[0.75rem] bg-white/[0.06] border-white/[0.14] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-black/90 backdrop-blur-3xl border-white/[0.14] rounded-[1.25rem]">
            <SelectItem value="newest" className="rounded-[0.75rem] text-xs">
              Newest
            </SelectItem>
            <SelectItem value="oldest" className="rounded-[0.75rem] text-xs">
              Oldest
            </SelectItem>
            <SelectItem value="confidence" className="rounded-[0.75rem] text-xs">
              Confidence
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <SmartFilters cameras={cameraList} filters={filters} onFiltersChange={handleFiltersChange} />

      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 pb-28">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-[1.25rem] overflow-hidden bg-white/[0.06] border border-white/[0.12]"
                >
                  <div className="aspect-video bg-white/[0.08]" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-white/[0.08] rounded-full w-3/4" />
                    <div className="h-2 bg-white/[0.06] rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              No events found for the current filters
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-[1px] rounded-[4px] cursor-pointer transition-all ${
                    selectedEventId === event.id
                      ? 'bg-primary/20 shadow-[0_0_24px_rgba(59,130,246,0.15)]'
                      : 'bg-white/[0.08] hover:bg-white/[0.12]'
                  }`}
                  onClick={() => handleEventSelect(event.id)}
                >
                  <div className="rounded-[3px] bg-card overflow-hidden">
                    <div className="relative aspect-video bg-black">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={`Event on ${event.cameraName}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-white/60">
                          No image
                        </div>
                      )}
                      {(event.personCount ?? 0) > 0 && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px]">
                          {event.personCount} {event.personCount === 1 ? 'person' : 'persons'}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-medium text-foreground truncate">
                        {event.cameraName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination>
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={currentPage === 1 ? undefined : () => handlePageChange(currentPage - 1)}
                      className={currentPage === 1 ? 'pointer-events-none opacity-40' : ''}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 7) page = i + 1;
                    else if (currentPage <= 4) page = i + 1;
                    else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                    else page = currentPage - 3 + i;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => handlePageChange(page)}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={
                        currentPage === totalPages ? undefined : () => handlePageChange(currentPage + 1)
                      }
                      className={currentPage === totalPages ? 'pointer-events-none opacity-40' : ''}
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
              events={events}
              onClose={() => updateParams({ eventId: null })}
              onNext={() => goToSibling(1)}
              onPrevious={() => goToSibling(-1)}
              onDelete={handleEventDelete}
              onDownload={handleEventDownload}
            />
            <div className="w-full xl:w-[320px] xl:border-l border-t xl:border-t-0 border-white/[0.12] overflow-y-auto bg-black/20">
              <RelatedEvents
                currentEvent={selectedEvent}
                events={events}
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
