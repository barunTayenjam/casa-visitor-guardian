import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { MotionEvent } from '@/types/security';
import { SmartFilters, FilterState } from '@/components/events/SmartFilters';
import { EventDetailPanel } from '@/components/events/EventDetailPanel';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { EmptyState } from '@/components/ui/EmptyState';
import { eventService } from '@/services/api/eventService';
import { detectionService } from '@/services/api/detectionService';
import { Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface HumanVerificationMeta {
  tier: 'yolo_high' | 'face' | 'pose' | 'score_floor' | 'disabled';
  keypoints: number;
  faceDetected: boolean;
  elapsedMs: number;
}

const TIER_LABELS: Record<HumanVerificationMeta['tier'], string> = {
  yolo_high: 'YOLO ≥ 0.90',
  face: 'Face detected',
  pose: 'Pose skeleton',
  score_floor: 'Score floor',
  disabled: 'Verifier off',
};

const TIER_COLORS: Record<HumanVerificationMeta['tier'], string> = {
  yolo_high: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  face: 'text-green-400 bg-green-500/10 border-green-500/20',
  pose: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  score_floor: 'text-muted-foreground bg-white/[0.06] border-white/[0.10]',
  disabled: 'text-muted-foreground bg-white/[0.06] border-white/[0.10]',
};

function getVerification(event: MotionEvent): HumanVerificationMeta | null {
  const hv = event.metadata?.humanVerification as HumanVerificationMeta | undefined;
  return hv && typeof hv.tier === 'string' ? hv : null;
}

const EventsPage = () => {
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);
  const [analysisByEvent, setAnalysisByEvent] = useState<Record<string, AnalysisEntry>>({});

  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const sortBy = (searchParams.get('sortBy') || 'newest') as SortOption;
  const selectedEventId = searchParams.get('eventId');
  const filters = useMemo(() => getFilterFromParams(searchParams), [searchParams]);

  // Load existing analysis if not in state
  useEffect(() => {
    if (!selectedEventId || analysisByEvent[selectedEventId]) return;

    let cancelled = false;
    detectionService
      .getEventAnalysis(selectedEventId)
      .then((res) => {
        if (cancelled) return;
        if (res.analysis) {
          const a = res.analysis;
          setAnalysisByEvent((prev) => ({
            ...prev,
            [selectedEventId]: {
              sceneDescription: a.sceneDescription || '',
              summary: a.summary || a.sceneDescription || '',
              threatAssessment: a.threatAssessment,
              detectedEntities: a.detectedEntities,
              recommendedActions: a.recommendedActions,
              modelUsed: a.model,
              processingTime: a.processing_time_ms || 0,
              boxes: res.boxes?.length ? res.boxes : undefined,
            },
          }));
        }
      })
      .catch(() => {
        // stored analysis unavailable — panel simply stays empty until analyzed
      });

    return () => { cancelled = true; };
  }, [selectedEventId, analysisByEvent]);


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
          detections: (event.object_detections || []).map((d) => ({
            type: (d.class === 'person' || d.class === 'face' ? d.class : 'object') as 'person' | 'face' | 'object',
            confidence: typeof d.confidence === 'number' && d.confidence > 1 ? d.confidence / 100 : d.confidence,
            name: d.identity ?? undefined,
            isKnown: !!d.identity && d.identity !== 'unknown',
            boundingBox: {
              x: d.bbox?.x ?? 0,
              y: d.bbox?.y ?? 0,
              width: d.bbox?.width ?? 0,
              height: d.bbox?.height ?? 0,
            },
          })),
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

  const handleAnalyzeEvent = useCallback(
    async (eventId: string) => {
      setAnalyzingEventId(eventId);
      try {
        const [result, boxesResult] = await Promise.allSettled([
          detectionService.analyzeEvent(eventId),
          detectionService.analyzeEventWithBboxes(eventId),
        ]);

        if (result.status === 'fulfilled' && result.value.success && result.value.analysis) {
          const a = result.value.analysis;
          const boxes =
            boxesResult.status === 'fulfilled' ? boxesResult.value.boxes : undefined;
          setAnalysisByEvent((prev) => ({
            ...prev,
            [eventId]: {
              sceneDescription: a.sceneDescription || a.overall_summary || a.summary || '',
              summary: a.summary,
              threatAssessment:
                a.threatAssessment || { level: 'low', factors: [], confidence: 0 },
              detectedEntities: a.detectedEntities || {
                people: (a.persons as string[]) || [],
                vehicles: (a.vehicles as string[]) || [],
                animals: [],
                objects: [],
              },
              recommendedActions: a.recommendedActions || [],
              processingTime: a.processing_time_ms || a.processingTime || 0,
              modelUsed: a.model || a.modelUsed || 'unknown',
              boxes,
            },
          }));
          toast({
            title: 'AI Analysis Complete',
            description: a.overall_summary || a.sceneDescription || a.summary || 'Event analyzed',
          });
        } else {
          toast({
            title: 'Analysis Failed',
            description:
              result.status === 'fulfilled'
                ? result.value.message || 'Unknown error'
                : 'Analysis request failed',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Analysis Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setAnalyzingEventId(null);
      }
    },
    [toast],
  );

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
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="w-full px-6 pt-6 pb-3 border-b border-white/[0.10]">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Events</h1>
          <Select value={sortBy} onValueChange={(value: SortOption) => handleSortChange(value)}>
            <SelectTrigger className="w-[130px] h-8 rounded-md bg-white/[0.04] border-white/[0.10] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/[0.10] rounded-lg">
              <SelectItem value="newest" className="rounded-md text-xs">
                Newest
              </SelectItem>
              <SelectItem value="oldest" className="rounded-md text-xs">
                Oldest
              </SelectItem>
              <SelectItem value="confidence" className="rounded-md text-xs">
                Confidence
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <SmartFilters cameras={cameraList} filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Content */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-10">
          <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg overflow-hidden bg-card border border-white/[0.10]"
                >
                  <div className="aspect-video bg-white/[0.04]" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                    <div className="h-2 bg-white/[0.04] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events found"
              description="No confirmed person events match these filters. Try widening the date range or switching to All Events."
              className="py-20"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {events.map((event) => {
                const verification = getVerification(event);
                return (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedEventId === event.id}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEventSelect(event.id);
                      }
                    }}
                    className={cn(
                      'rounded-lg cursor-pointer transition-all duration-200',
                      selectedEventId === event.id
                        ? 'border-2 border-primary/60 bg-card'
                        : 'border border-white/[0.10] hover:border-white/[0.16]',
                    )}
                    onClick={() => handleEventSelect(event.id)}
                  >
                    {/* Image */}
                    <div className="relative aspect-video bg-black">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={`Event on ${event.cameraName}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-white/40">
                          No image
                        </div>
                      )}

                      {/* Verification badge */}
                      {verification && (
                        <div className={cn(
                          'absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
                          TIER_COLORS[verification.tier],
                        )}>
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {TIER_LABELS[verification.tier]}
                        </div>
                      )}

                      {/* Person count */}
                      {(event.personCount ?? 0) > 0 && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-white text-xs font-medium">
                          {event.personCount} {event.personCount === 1 ? 'person' : 'persons'}
                        </div>
                      )}

                      {/* Confidence */}
                      <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-xs font-mono tabular-nums">
                        <span className={cn(
                          event.confidence >= 0.8 ? 'text-green-400' :
                          event.confidence >= 0.5 ? 'text-amber-400' : 'text-muted-foreground',
                        )}>
                          {(event.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground/90 truncate">
                          {event.cameraName}
                        </p>
                        {verification && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {verification.tier === 'yolo_high' && <AlertTriangle className="w-3 h-3 text-blue-400" />}
                            {verification.tier === 'face' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                            {verification.tier === 'pose' && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono tabular-nums">
                        {event.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
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
        </div>

        {/* Event Detail Panel */}
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
              onAnalyze={handleAnalyzeEvent}
              analyzing={analyzingEventId === selectedEvent.id}
              analysis={analysisByEvent[selectedEvent.id] ?? null}
              boxes={analysisByEvent[selectedEvent.id]?.boxes}
            />
            <div className="w-full xl:w-[320px] xl:border-l border-t xl:border-t-0 border-white/[0.10] overflow-y-auto bg-background">
              {/* Verification Panel */}
              {getVerification(selectedEvent) && (
                <div className="m-4 p-4 rounded-lg bg-card border border-white/[0.10]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Human Verification
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Verified
                    </span>
                  </div>
                  {(() => {
                    const v = getVerification(selectedEvent)!;
                    const rows: Array<[string, string]> = [
                      ['Method', TIER_LABELS[v.tier]],
                      ['Pose keypoints', String(v.keypoints)],
                      ['Face detected', v.faceDetected ? 'Yes' : 'No'],
                      ['Check latency', `${v.elapsedMs} ms`],
                    ];
                    return rows.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.06] last:border-0">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-foreground/90 font-medium font-mono tabular-nums">{value}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
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

type AnalysisEntry = {
  sceneDescription?: string;
  summary?: string;
  threatAssessment?: { level: string; factors: string[]; confidence: number };
  detectedEntities?: { people: string[]; vehicles: string[]; animals: string[]; objects: string[] };
  recommendedActions?: string[];
  processingTime?: number;
  modelUsed?: string;
  boxes?: Array<{ label: string; confidence: number; x: number; y: number; width: number; height: number }>;
};

export default EventsPage;
