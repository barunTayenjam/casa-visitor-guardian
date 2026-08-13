import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { MotionEvent } from '@/types/security';
import { EventTimeline } from '@/components/events/EventTimeline';
import { SmartFilters, FilterState } from '@/components/events/SmartFilters';
import { EventDetailPanel } from '@/components/events/EventDetailPanel';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { Calendar, Clock, User, Grid, List, Archive, Download, Brain, Film, Users, UserCheck, Moon, ChevronLeft, ChevronRight, Play, Pause, SkipBack, SkipForward, X, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { eventService } from '@/services/api/eventService';
import { detectionService } from '@/services/api/detectionService';
import { systemService } from '@/services/api/systemService';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'confidence';
type AnalysisEntry = {
  sceneDescription?: string; summary?: string;
  sceneContext?: { environment: string; weather?: string; lighting?: string; };
  threatAssessment?: { level: string; factors: string[]; confidence: number };
  detectedEntities?: { people: string[]; vehicles: string[]; animals: string[]; objects: string[] };
  recommendedActions?: string[]; processingTime?: number; modelUsed?: string;
  overall_summary?: string; activities?: string[];
  persons?: Record<string, unknown>[]; vehicles?: Record<string, unknown>[];
  boxes?: Array<{ label: string; confidence: number; x: number; y: number; width: number; height: number }>;
};

const getLabelColor = (label: string): string => {
  const colorMap: Record<string, string> = {
    person: '22c55e', vehicle: '3b82f6', face: '8b5cf6',
    package: '06b6d4', motion: 'f59e0b',
  };
  return colorMap[label] || colorMap.motion;
};

function formatConfidence(value: number): string {
  if (value <= 0) return '0%';
  if (value < 0.5) return '< 1%';
  return `${Math.round(value)}%`;
}

interface ApiEvent {
  id: string; cameraId: string; cameraName?: string; timestamp: string;
  imageUrl?: string; filename?: string; confidence: number; event_type: string;
  severity?: 'alert' | 'detection' | 'info';
  metadata: Record<string, unknown>; labels?: string[]; persons_detected: number;
  faces_detected: number; known_faces_count: number; unknown_faces_count: number;
  object_detections: unknown[]; face_detections: unknown[];
  analysis?: {
    sceneDescription?: string;
    threatAssessment?: { level: string; factors: string[]; confidence: number };
    detectedEntities?: { people: string[]; vehicles: string[]; objects: string[]; animals: string[] };
    recommendedActions?: string[];
    modelUsed?: string;
    processingTime?: number;
    analyzedAt?: string;
  } | null;
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function readFiltersFromParams(searchParams: URLSearchParams): FilterState {
  const cameraId = searchParams.get('cameraId') || 'all';
  const detectionType = (searchParams.get('detectionType') || 'person') as FilterState['detectionType'];
  const quickRange = (searchParams.get('quickRange') || 'all') as FilterState['quickRange'];
  if (quickRange !== 'all') {
    return { cameraId, detectionType, dateRange: { start: undefined, end: undefined }, quickRange };
  }
  const start = parseDateParam(searchParams.get('startDate'));
  const end = parseDateParam(searchParams.get('endDate'));
  return { cameraId, detectionType, dateRange: { start, end }, quickRange: start ? 'all' : 'all' };
}

function readSortFromParams(searchParams: URLSearchParams): SortOption {
  const val = searchParams.get('sortBy');
  if (val === 'oldest' || val === 'confidence') return val;
  return 'newest';
}

type CategoryFilter = 'all' | 'persons' | 'known' | 'unknown' | 'night';

const EventsPage = () => {
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(() => {
    const p = parseInt(searchParams.get('page') || '1');
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [todayEvents, setTodayEvents] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>(() => readSortFromParams(searchParams));
  const [filters, setFilters] = useState<FilterState>(() => readFiltersFromParams(searchParams));

  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);
  const [analysisByEvent, setAnalysisByEvent] = useState<Record<string, AnalysisEntry>>({});

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'alert' | 'detection' | 'info'>('all');
  const [daySummary, setDaySummary] = useState<{ totalEvents: number; totalPersons: number; totalFaces: number; knownFaces: number; knownEvents: number; unknownEvents: number; nightEvents: number } | null>(null);
  const [showTimelapse, setShowTimelapse] = useState(false);
  const [timelapseList, setTimelapseList] = useState<Array<{ cameraId: string; path: string }>>([]);
  const [activeTimelapseCam, setActiveTimelapseCam] = useState<string | null>(null);
  const [timelapseLoading, setTimelapseLoading] = useState(false);

  const [showSlideshow, setShowSlideshow] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(true);
  const [slideshowSpeed, setSlideshowSpeed] = useState(2);
  const slideshowIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const slideshowPreloadRef = React.useRef<Set<string>>(new Set());

  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const handleAnalyzeEvent = async (eventId: string) => {
    setAnalyzingEventId(eventId);
    try {
      const [result, boxesResult] = await Promise.allSettled([
        detectionService.analyzeEvent(eventId),
        detectionService.analyzeEventWithBboxes(eventId),
      ]);

      if (result.status === 'fulfilled' && result.value.success && result.value.analysis) {
        const a = result.value.analysis;
        const boxes = boxesResult.status === 'fulfilled' ? boxesResult.value.boxes : undefined;
        setAnalysisByEvent(prev => ({ ...prev, [eventId]: {
          sceneDescription: a.sceneDescription || a.overall_summary || a.summary || '',
          summary: a.summary,
          threatAssessment: a.threatAssessment || { level: 'low', factors: [], confidence: 0 },
          detectedEntities: a.detectedEntities || {
            people: (a.persons as string[]) || [], vehicles: (a.vehicles as string[]) || [],
            animals: [], objects: [],
          },
          recommendedActions: a.recommendedActions || [],
          processingTime: a.processing_time_ms || a.processingTime || 0,
          modelUsed: a.model || a.modelUsed || 'unknown',
          boxes,
        }}));
        toast({ title: 'AI Analysis Complete', description: a.overall_summary || a.sceneDescription || a.summary || 'Event analyzed' });
      } else {
        toast({ title: 'Analysis Failed', description: (result.status === 'fulfilled' ? (result.value.message || 'Unknown error') : 'Analysis request failed'), variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Analysis Failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
    finally { setAnalyzingEventId(null); }
  };

  const quickRangeOptions = useMemo(() => [
    { label: 'All Time', value: 'all' as const, getDates: () => ({ start: new Date(2020, 0, 1), end: new Date() }) },
    { label: 'Today', value: 'today' as const, getDates: () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setHours(23, 59, 59, 999);
      return { start, end };
    }},
    { label: 'Yesterday', value: 'yesterday' as const, getDates: () => {
      const start = new Date(Date.now() - 86400000); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setHours(23, 59, 59, 999);
      return { start, end };
    }},
    { label: 'Last 7 Days', value: 'last7days' as const, getDates: () => {
      const start = new Date(Date.now() - 6 * 86400000); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      return { start, end };
    }},
    { label: 'Last 30 Days', value: 'last30days' as const, getDates: () => {
      const start = new Date(Date.now() - 29 * 86400000); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      return { start, end };
    }},
  ], []);

  const isSingleDay = useMemo(() => {
    return filters.dateRange.start && filters.dateRange.end && format(filters.dateRange.start, 'yyyy-MM-dd') === format(filters.dateRange.end, 'yyyy-MM-dd');
  }, [filters]);

  const dateStr = useMemo(() => isSingleDay ? format(filters.dateRange.start!, 'yyyy-MM-dd') : null, [isSingleDay, filters.dateRange.start]);

  const loadSummaryAndTimelapse = useCallback(async () => {
    if (!dateStr) {
      setDaySummary(null);
      setTimelapseList([]);
      return;
    }
    setTimelapseLoading(true);
    try {
      const [summaryRes, timelapseRes] = await Promise.all([
        systemService.getDaySummary(dateStr),
        systemService.getTimelapses(dateStr)
      ]);
      if (summaryRes.success) setDaySummary(summaryRes.summary);
      if (timelapseRes.success) setTimelapseList(timelapseRes.timelapses);
    } catch (e) {
      console.error(e);
    } finally {
      setTimelapseLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    loadSummaryAndTimelapse();
  }, [loadSummaryAndTimelapse]);

  const applyCategoryFilters = useCallback((evs: MotionEvent[]) => {
    return evs.filter(h => {
      if (severityFilter !== 'all' && h.severity !== severityFilter) return false;
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'persons') return h.personCount > 0;
      if (categoryFilter === 'known') return h.knownFaces > 0;
      if (categoryFilter === 'unknown') return h.unknownFaces > 0;
      if (categoryFilter === 'night') {
        const hour = h.timestamp.getHours();
        return hour >= 22 || hour <= 6;
      }
      return true;
    });
  }, [categoryFilter, severityFilter]);

  useEffect(() => {
    setFilteredEvents(applyCategoryFilters(events));
  }, [events, categoryFilter, applyCategoryFilters]);

  useEffect(() => {
    if (slideshowPlaying && filteredEvents.length > 0) {
      slideshowIntervalRef.current = setInterval(() => {
        setSlideshowIndex(prev => (prev + 1) % filteredEvents.length);
      }, slideshowSpeed * 1000);
    } else {
      if (slideshowIntervalRef.current) clearInterval(slideshowIntervalRef.current);
    }
    return () => { if (slideshowIntervalRef.current) clearInterval(slideshowIntervalRef.current); };
  }, [slideshowPlaying, filteredEvents.length, slideshowSpeed]);

  useEffect(() => {
    if (filteredEvents.length === 0) return;
    const N = 6;
    for (let i = 1; i <= N; i++) {
      const idx = (slideshowIndex + i) % filteredEvents.length;
      const url = filteredEvents[idx]?.imageUrl;
      if (url && !slideshowPreloadRef.current.has(url)) {
        slideshowPreloadRef.current.add(url);
        new Image().src = url;
      }
    }
  }, [slideshowIndex, filteredEvents]);

  const syncUrl = useCallback((f: FilterState, s: SortOption, page: number) => {
    const params = new URLSearchParams();
    if (f.cameraId !== 'all') params.set('cameraId', f.cameraId);
    if (f.detectionType !== 'all') params.set('detectionType', f.detectionType);
    if (f.quickRange !== 'all') {
      params.set('quickRange', f.quickRange);
    } else if (f.dateRange.start) {
      params.set('startDate', format(f.dateRange.start, 'yyyy-MM-dd'));
      if (f.dateRange.end) params.set('endDate', format(f.dateRange.end, 'yyyy-MM-dd'));
    }
    if (s !== 'newest') params.set('sortBy', s);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    syncUrl(filters, sortBy, currentPage);
  }, [filters, sortBy, currentPage, syncUrl]);

  useEffect(() => { setCurrentPage(1); }, [filters]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;
      if (filters.quickRange !== 'all') {
        const option = quickRangeOptions.find(o => o.value === filters.quickRange);
        if (option) {
          const dates = option.getDates();
          startDate = dates.start.toISOString();
          endDate = dates.end.toISOString();
        }
      } else if (filters.dateRange.start && filters.dateRange.end) {
        startDate = filters.dateRange.start.toISOString();
        endDate = filters.dateRange.end.toISOString();
      }

      const [response, dailyCount] = await Promise.all([
        eventService.getEnhancedEventsList({
          page: currentPage, pageSize: 25,
          camera_id: filters.cameraId === 'all' ? undefined : filters.cameraId,
          start_date: startDate,
          end_date: endDate,
          event_type: filters.detectionType === 'all' ? undefined : filters.detectionType,
          sortBy: sortBy,
        }),
        eventService.getDailyStats()
      ]);
      setTodayEvents(dailyCount);
      const transformedEvents = response.events.map((event: ApiEvent): MotionEvent => ({
        id: event.id, cameraId: event.cameraId, cameraName: event.cameraName || `Camera ${event.cameraId}`,
        timestamp: new Date(event.timestamp), imageUrl: event.imageUrl || event.filename || null,
        confidence: event.confidence || 0, labels: event.labels || [event.event_type || 'motion'],
        location: event.cameraName || `Camera ${event.cameraId}`, duration: 0, archived: false,
        metadata: event.metadata || {}, detections: [], personCount: event.persons_detected || 0,
        faceCount: event.faces_detected || 0, knownFaces: event.known_faces_count || 0,
        unknownFaces: event.unknown_faces_count || 0, severity: event.severity,
      }));
      setEvents(transformedEvents);
      setFilteredEvents(transformedEvents);
      const persistedAnalysis: Record<string, AnalysisEntry> = {};
      for (const event of response.events) {
        if (event.analysis) {
          const a = event.analysis;
          persistedAnalysis[event.id] = {
            sceneDescription: a.sceneDescription || '',
            summary: a.sceneDescription || '',
            threatAssessment: a.threatAssessment || { level: 'low', factors: [], confidence: 0 },
            detectedEntities: a.detectedEntities || { people: [], vehicles: [], animals: [], objects: [] },
            recommendedActions: a.recommendedActions || [],
            processingTime: a.processingTime || 0,
            modelUsed: a.modelUsed || 'cached',
          };
        }
      }
      if (Object.keys(persistedAnalysis).length > 0) {
        setAnalysisByEvent(prev => ({ ...prev, ...persistedAnalysis }));
      }
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
        setTotalEvents(response.pagination.totalEvents);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load motion events', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [filters, toast, currentPage, sortBy, quickRangeOptions]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSortChange = useCallback((value: SortOption) => {
    setSortBy(value);
  }, []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedEventId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEventSelect = (eventId: string) => setSelectedEventId(eventId);

  const handleEventDelete = async (eventId: string) => {
    try {
      await eventService.archiveEvent(eventId);
      toast({ title: 'Event Deleted', description: 'The event has been deleted.' });
      setSelectedEventId(null);
      loadEvents();
    } catch { toast({ title: 'Error', description: 'Failed to delete event', variant: 'destructive' }); }
  };

  const handleEventDownload = (event: MotionEvent) => {
    if (event.imageUrl) {
      const link = document.createElement('a');
      link.href = event.imageUrl;
      link.download = `event_${event.cameraId}.jpg`;
      link.click();
      toast({ title: 'Downloaded', description: 'Event image has been downloaded.' });
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) newSet.delete(eventId);
      else newSet.add(eventId);
      setShowBulkActions(newSet.size > 0);
      return newSet;
    });
  };

  const selectAllEvents = useCallback(() => {
    if (selectedEventIds.size === events.length) {
      setSelectedEventIds(new Set()); setShowBulkActions(false);
    } else {
      setSelectedEventIds(new Set(events.map(e => e.id))); setShowBulkActions(true);
    }
  }, [selectedEventIds.size, events]);

  const clearSelection = useCallback(() => {
    setSelectedEventIds(new Set()); setShowBulkActions(false);
  }, []);

  const bulkDelete = async () => {
    if (selectedEventIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedEventIds.size} events?`)) return;
    try {
      await Promise.all(Array.from(selectedEventIds).map(id => eventService.archiveEvent(id)));
      toast({ title: 'Events Deleted', description: `${selectedEventIds.size} events have been deleted.` });
      clearSelection(); loadEvents();
    } catch { toast({ title: 'Error', description: 'Failed to delete some events', variant: 'destructive' }); }
  };

  const bulkExport = () => {
    if (selectedEventIds.size === 0) return;
    const selected = events.filter(e => selectedEventIds.has(e.id));
    const blob = new Blob([JSON.stringify(selected.map(e => ({
      id: e.id, cameraId: e.cameraId, timestamp: e.timestamp.toISOString(),
      confidence: e.confidence, labels: e.labels,
    })), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `events_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    toast({ title: 'Exported', description: `${selectedEventIds.size} events exported to JSON.` });
  };

  const goToNextEvent = () => {
    if (!selectedEvent) return;
    const idx = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (idx < filteredEvents.length - 1) setSelectedEventId(filteredEvents[idx + 1].id);
  };

  const goToPreviousEvent = () => {
    if (!selectedEvent) return;
    const idx = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (idx > 0) setSelectedEventId(filteredEvents[idx - 1].id);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey && e.key === 'a' && !selectedEventId) { e.preventDefault(); selectAllEvents(); return; }
    if (e.key === 'Escape') { if (showBulkActions) clearSelection(); else setSelectedEventId(null); }
    else if (selectedEventId) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedEventId(prev => {
          const idx = filteredEvents.findIndex(ev => ev.id === prev);
          return idx > 0 ? filteredEvents[idx - 1].id : prev;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedEventId(prev => {
          const idx = filteredEvents.findIndex(ev => ev.id === prev);
          return idx < filteredEvents.length - 1 ? filteredEvents[idx + 1].id : prev;
        });
      }
    }
  }, [selectedEventId, filteredEvents, showBulkActions, selectAllEvents, clearSelection]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;
  const cameraList = cameras.map(c => ({ id: c.id, name: c.name }));

  const stats = { total: totalEvents, today: todayEvents };

  return (
    <>
    <div className="w-full min-h-[100dvh] flex flex-col">
      <div className="px-5 pt-6 pb-2 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
              Security Log
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          </div>
          <div className="flex items-center gap-3">
            {isSingleDay && daySummary && (
              <div className="hidden md:flex items-center gap-6 bg-white/[0.04] border border-white/[0.08] rounded-[1.25rem] px-5 py-2">
                <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Persons</span><span className="text-sm font-semibold">{daySummary.totalPersons}</span></div>
                <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Faces</span><span className="text-sm font-semibold">{daySummary.totalFaces}</span></div>
                <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Known</span><span className="text-sm font-semibold text-green-400">{daySummary.knownFaces}</span></div>
                <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase">Night</span><span className="text-sm font-semibold text-purple-400">{daySummary.nightEvents}</span></div>
              </div>
            )}
            <div className="flex items-center gap-3 mr-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground">{stats.total} total</span>
              </div>
            </div>
            {isSingleDay && timelapseList.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowTimelapse(true)} className="text-xs">
                <Film className="w-3.5 h-3.5 mr-1.5" /> Timelapse
              </Button>
            )}
            {showBulkActions ? (
              <div className="flex items-center gap-2 bg-white/[0.08] border border-white/[0.14] rounded-[1.25rem] px-3 py-1">
                <span className="text-xs text-foreground">{selectedEventIds.size} selected</span>
                <Button size="sm" variant="ghost" onClick={selectAllEvents} className="text-xs h-8">
                  {selectedEventIds.size === events.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button size="sm" variant="ghost" onClick={bulkExport} className="text-xs h-8">
                  <Download className="h-3 w-3 mr-1" /> Export
                </Button>
                <Button size="sm" variant="ghost" onClick={bulkDelete} className="text-xs h-8 text-red-400 hover:text-red-300">
                  <Archive className="h-3 w-3 mr-1" /> Delete
                </Button>
                <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground text-xs h-8 w-8 rounded-full flex items-center justify-center">
                  ✕
                </button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setShowBulkActions(true)} className="text-xs">
                Select
              </Button>
            )}
            <Select value={sortBy} onValueChange={(value: SortOption) => handleSortChange(value)}>
              <SelectTrigger className="w-full sm:w-[130px] h-9 rounded-[0.75rem] bg-white/[0.06] border-white/[0.14] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 backdrop-blur-3xl border-white/[0.14] rounded-[1.25rem]">
                <SelectItem value="newest" className="rounded-[0.75rem]">Newest</SelectItem>
                <SelectItem value="oldest" className="rounded-[0.75rem]">Oldest</SelectItem>
                <SelectItem value="confidence" className="rounded-[0.75rem]">Confidence</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 bg-white/[0.06] rounded-[1.25rem] p-1 border border-white/[0.12]">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon-sm" onClick={() => setViewMode('grid')} aria-label="Grid view">
                <Grid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon-sm" onClick={() => setViewMode('list')} aria-label="List view">
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SmartFilters cameras={cameraList} filters={filters} onFiltersChange={handleFiltersChange} />

      {filteredEvents.length > 0 && (
        <div className="px-5 py-2 flex items-center gap-2 flex-wrap">
          <Button onClick={() => setCategoryFilter('all')} variant={categoryFilter === 'all' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            All <Badge variant="outline" className="ml-1.5 text-[9px] h-4 px-1.5 rounded-full">{filteredEvents.length}</Badge>
          </Button>
          <Button onClick={() => setCategoryFilter('persons')} variant={categoryFilter === 'persons' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            <Users className="w-3 h-3 mr-1" /> Persons
          </Button>
          <Button onClick={() => setCategoryFilter('known')} variant={categoryFilter === 'known' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            <UserCheck className="w-3 h-3 mr-1" /> Known
          </Button>
          <Button onClick={() => setCategoryFilter('unknown')} variant={categoryFilter === 'unknown' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            <User className="w-3 h-3 mr-1" /> Unknown
          </Button>
          <Button onClick={() => setCategoryFilter('night')} variant={categoryFilter === 'night' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            <Moon className="w-3 h-3 mr-1" /> Night
          </Button>
          <div className="w-px h-5 bg-white/[0.1]" />
          <Button onClick={() => setSeverityFilter('all')} variant={severityFilter === 'all' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            All Severity
          </Button>
          <Button onClick={() => setSeverityFilter('alert')} variant={severityFilter === 'alert' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            <ShieldAlert className="w-3 h-3 mr-1" /> Alerts
          </Button>
          <Button onClick={() => setSeverityFilter('detection')} variant={severityFilter === 'detection' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            <AlertTriangle className="w-3 h-3 mr-1" /> Detections
          </Button>
          <Button onClick={() => setSeverityFilter('info')} variant={severityFilter === 'info' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 rounded-full">
            <Info className="w-3 h-3 mr-1" /> Info
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowSlideshow(true); setSlideshowIndex(0); setSlideshowPlaying(true); }} className="text-xs h-7 rounded-full" title="Present">
              <Play className="w-3 h-3 mr-1" /> Present
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowKeyboardHelp(true)} className="text-xs h-7 rounded-full">
              <span className="text-xs">⌨</span>
            </Button>
          </div>
        </div>
      )}

      {(() => {
        const pageSize = 100;
        const showingStart = totalEvents === 0 ? 0 : (currentPage - 1) * pageSize + 1;
        const showingEnd = Math.min(currentPage * pageSize, totalEvents);
        return (
          <div className="px-5 py-2">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{showingStart}-{showingEnd}</span> of <span className="font-medium text-foreground">{totalEvents}</span> events
            </p>
          </div>
        );
      })()}

      {viewMode === 'grid' && (
        <EventTimeline events={filteredEvents} selectedEventId={selectedEventId || undefined} onEventSelect={handleEventSelect} />
      )}

      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 pb-28">
          {loading ? (
            <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'space-y-3', 'gap-4')}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-[1.25rem] overflow-hidden bg-white/[0.06] border border-white/[0.12]">
                  <div className="aspect-video bg-white/[0.08]" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-white/[0.08] rounded-full w-3/4" />
                    <div className="h-2 bg-white/[0.06] rounded-full w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState icon={Calendar} title="No Events Found" description="Try adjusting your filters or check back later" />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    'p-[1px] rounded-[4px] bg-white/[0.08] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer',
                    'hover:bg-white/[0.08] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]',
                    selectedEventId === event.id && 'bg-primary/20 shadow-[0_0_24px_rgba(59,130,246,0.15)]',
                    'opacity-0',
                  )}
                  style={{
                    animation: `slide-up-reveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${index * 50}ms forwards`,
                  }}
                  onClick={() => handleEventSelect(event.id)}
                >
                  <div className="rounded-[3px] bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden">
                    <div className="relative aspect-video bg-black overflow-hidden">
                      {event.imageUrl ? (
                        <ProgressiveImage src={event.imageUrl} alt={`Motion event: ${event.labels?.[0] || 'detection'} on ${event.cameraName}`} className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><p className="text-xs text-white/60">No image</p></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]" />
                      {event.labels && event.labels.length > 0 && (
                        <div className="absolute top-2 left-2 z-10 flex gap-1">
                          <div className="px-2 py-1 rounded-full text-[10px] font-semibold text-white backdrop-blur-md" style={{ backgroundColor: `#${getLabelColor(event.labels[0])}DD` }}>
                            {event.labels[0]}
                          </div>
                          {event.severity && (
                            <div className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-semibold backdrop-blur-md flex items-center gap-1",
                              event.severity === 'alert' ? "bg-red-500/80 text-white" :
                              event.severity === 'detection' ? "bg-yellow-500/80 text-black" :
                              "bg-blue-500/60 text-white"
                            )}>
                              {event.severity === 'alert' ? <ShieldAlert className="w-2.5 h-2.5" /> :
                               event.severity === 'detection' ? <AlertTriangle className="w-2.5 h-2.5" /> :
                               <Info className="w-2.5 h-2.5" />}
                              <span>{event.severity === 'alert' ? 'Alert' : event.severity === 'detection' ? 'Detect' : 'Info'}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {event.confidence > 0 && (
                        <div className="absolute top-2 right-2 z-10">
                          <div className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black/70 backdrop-blur-md text-white">
                            {formatConfidence(typeof event.confidence === 'number' && event.confidence <= 1 ? event.confidence * 100 : event.confidence)}
                          </div>
                        </div>
                      )}
                      {(event.personCount > 0 || event.faceCount > 0) && (
                        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2">
                          {event.personCount > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px]">
                              <User className="h-3 w-3" /> <span>{event.personCount}</span>
                            </div>
                          )}
                          {event.faceCount > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px]">
                              <span>👤 {event.faceCount}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 z-10 group/ai-btn">
                        <div className={cn(
                          "p-[1px] rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                          "group-hover/ai-btn:bg-white/[0.12] active:scale-[0.92]",
                          analysisByEvent[event.id] ? "bg-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.15)]" : "bg-white/[0.06]",
                          analyzingEventId === event.id && "bg-blue-500/30 animate-glow-pulse"
                        )}>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!analysisByEvent[event.id]) handleAnalyzeEvent(event.id); }}
                            disabled={analyzingEventId === event.id || !!analysisByEvent[event.id]}
                            title={analysisByEvent[event.id] ? "Already analyzed" : "AI Analyze"}
                            className={cn(
                              "relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden",
                              "bg-black/80 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]",
                              "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                              "active:scale-[0.88]",
                              analysisByEvent[event.id] ? "text-green-400" : "text-white/70 hover:text-white"
                            )}
                          >
                            {analyzingEventId === event.id && (
                              <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)] animate-shimmer-sweep" />
                              </div>
                            )}
                            {analyzingEventId === event.id ? (
                              <div className="relative flex items-center justify-center gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-white/80 animate-[pulse-soft_1.4s_ease-in-out_infinite]" />
                                <span className="w-1 h-1 rounded-full bg-white/80 animate-[pulse-soft_1.4s_ease-in-out_infinite_0.2s]" />
                                <span className="w-1 h-1 rounded-full bg-white/80 animate-[pulse-soft_1.4s_ease-in-out_infinite_0.4s]" />
                              </div>
                            ) : analysisByEvent[event.id] ? (
                              <Brain className="h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/ai-btn:translate-x-[0.5px] group-hover/ai-btn:-translate-y-[0.5px] group-hover/ai-btn:scale-105" />
                            ) : (
                              <Brain className="h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/ai-btn:translate-x-[0.5px] group-hover/ai-btn:-translate-y-[0.5px] group-hover/ai-btn:scale-105" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{event.cameraName}</p>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="truncate">{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
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
                    'p-[1px] rounded-[4px] bg-white/[0.06] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer',
                    'hover:bg-white/[0.06]',
                    selectedEventId === event.id && 'bg-primary/20',
                    'opacity-0',
                  )}
                  style={{
                    animation: `slide-up-reveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 40}ms forwards`,
                  }}
                  onClick={() => handleEventSelect(event.id)}
                >
                  <div className="rounded-[3px] bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-3">
                    <div className="flex items-center gap-4">
                      <div className="relative w-28 h-16 rounded-[0.75rem] overflow-hidden flex-shrink-0 bg-black">
                        {event.imageUrl ? (
                          <ProgressiveImage src={event.imageUrl} alt={`Motion event: ${event.labels?.[0] || 'detection'} on ${event.cameraName}`} className="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><p className="text-xs text-white/60">No image</p></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-medium text-foreground truncate">{event.cameraName}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {event.labels && event.labels.length > 0 && (
                              <div className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: `#${getLabelColor(event.labels[0])}DD` }}>
                                {event.labels[0]}
                              </div>
                            )}
                            {event.confidence > 0 && (
                              <div className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.08] text-muted-foreground">
                            {formatConfidence(typeof event.confidence === 'number' && event.confidence <= 1 ? event.confidence * 100 : event.confidence)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{new Date(event.timestamp).toLocaleString()}</span></div>
                          {event.personCount > 0 && (
                            <div className="flex items-center gap-1"><User className="h-3 w-3" /><span>{event.personCount}</span></div>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 group/ai-list">
                        <div className={cn(
                          "p-[1px] rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                          "group-hover/ai-list:bg-white/[0.12] active:scale-[0.92]",
                          analysisByEvent[event.id] ? "bg-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.15)]" : "bg-white/[0.06]",
                          analyzingEventId === event.id && "bg-blue-500/30 animate-glow-pulse"
                        )}>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!analysisByEvent[event.id]) handleAnalyzeEvent(event.id); }}
                            disabled={analyzingEventId === event.id || !!analysisByEvent[event.id]}
                            title={analysisByEvent[event.id] ? "Already analyzed" : "AI Analyze"}
                            className={cn(
                              "relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden",
                              "bg-black/80 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]",
                              "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                              "active:scale-[0.88]",
                              analysisByEvent[event.id] ? "text-green-400" : "text-white/70 hover:text-white"
                            )}
                          >
                            {analyzingEventId === event.id && (
                              <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)] animate-shimmer-sweep" />
                              </div>
                            )}
                            {analyzingEventId === event.id ? (
                              <div className="relative flex items-center justify-center gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-white/80 animate-[pulse-soft_1.4s_ease-in-out_infinite]" />
                                <span className="w-1 h-1 rounded-full bg-white/80 animate-[pulse-soft_1.4s_ease-in-out_infinite_0.2s]" />
                                <span className="w-1 h-1 rounded-full bg-white/80 animate-[pulse-soft_1.4s_ease-in-out_infinite_0.4s]" />
                              </div>
                            ) : analysisByEvent[event.id] ? (
                              <Brain className="h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/ai-list:translate-x-[0.5px] group-hover/ai-list:-translate-y-[0.5px] group-hover/ai-list:scale-105" />
                            ) : (
                              <Brain className="h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/ai-list:translate-x-[0.5px] group-hover/ai-list:-translate-y-[0.5px] group-hover/ai-list:scale-105" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <div className="p-[1px] rounded-[4px] bg-white/[0.08]">
                <div className="rounded-[3px] bg-card px-2 py-1.5">
                  <Pagination>
                    <PaginationContent className="gap-0">
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={currentPage === 1 ? undefined : () => handlePageChange(currentPage - 1)}
                          className={cn("h-10 w-10 rounded-full cursor-pointer", currentPage === 1 ? 'pointer-events-none opacity-40' : '')}
                        />
                      </PaginationItem>
                      {(() => {
                        const pages: (number | string)[] = [];
                        const maxVisible = 5;
                        if (totalPages <= maxVisible) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          if (currentPage <= 3) { for (let i = 1; i <= 4; i++) pages.push(i); pages.push('...'); pages.push(totalPages); }
                          else if (currentPage >= totalPages - 2) { pages.push(1); pages.push('...'); for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i); }
                          else { pages.push(1); pages.push('...'); for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i); pages.push('...'); pages.push(totalPages); }
                        }
                        return pages.map((pageNum, index) => (
                          pageNum === '...' ? (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <span className="flex h-9 w-9 items-center justify-center text-muted-foreground text-xs">...</span>
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => handlePageChange(pageNum as number)}
                                isActive={pageNum === currentPage}
                                className="h-10 w-10 rounded-full cursor-pointer text-xs"
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
                          className={cn("h-10 w-10 rounded-full cursor-pointer", currentPage === totalPages ? 'pointer-events-none opacity-40' : '')}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
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
              onAnalyze={handleAnalyzeEvent}
              analyzing={analyzingEventId === selectedEvent.id}
              analysis={selectedEvent ? analysisByEvent[selectedEvent.id] : null}
              boxes={selectedEvent ? analysisByEvent[selectedEvent.id]?.boxes : undefined}
            />
            <div className="w-full xl:w-[400px] 2xl:w-[500px] xl:border-l border-t xl:border-t-0 border-white/[0.12] overflow-y-auto bg-black/20">
              <RelatedEvents currentEvent={selectedEvent} events={filteredEvents} onEventSelect={handleEventSelect} />
            </div>
          </>
        )}
      </div>
      </div>

      {/* Timelapse Modal */}
      {showTimelapse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowTimelapse(false)}>
          <div className="bg-black/90 border border-white/[0.14] rounded-[1.25rem] w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between hairline-bottom">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Film className="w-5 h-5 text-purple-400" /> Daily Timelapse</h2>
              <Button size="icon-sm" variant="ghost" onClick={() => setShowTimelapse(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {timelapseList.map(t => (
                <Button key={t.cameraId} onClick={() => setActiveTimelapseCam(t.cameraId)} variant={activeTimelapseCam === t.cameraId ? 'default' : 'outline'} size="sm">
                  {cameras.find(c => c.id === t.cameraId)?.name || t.cameraId}
                </Button>
              ))}
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              {activeTimelapseCam ? (
                <video key={activeTimelapseCam} src={timelapseList.find(t => t.cameraId === activeTimelapseCam)?.path} controls autoPlay loop className="w-full h-full object-contain" />
              ) : <p className="text-muted-foreground">Select a camera</p>}
            </div>
          </div>
        </div>
      )}

      {/* Slideshow Modal */}
      {showSlideshow && filteredEvents.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setShowSlideshow(false)}>
          <div className="relative w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <Button size="icon" variant="ghost" onClick={() => setShowSlideshow(false)} className="absolute top-4 right-4 text-white hover:text-white"><X className="w-8 h-8" /></Button>
            <div className="relative w-full max-h-[80vh] flex items-center justify-center">
              <ProgressiveImage src={filteredEvents[slideshowIndex].imageUrl || ''} alt="" className="max-w-full max-h-[80vh] object-contain" />
            </div>
            <div className="absolute bottom-10 flex items-center gap-4 p-4 rounded-full bg-black/40 backdrop-blur-md">
              <Button size="icon" variant="ghost" className="text-white hover:text-white" onClick={e => { e.stopPropagation(); setSlideshowIndex(prev => (prev - 1 + filteredEvents.length) % filteredEvents.length); }}><SkipBack className="w-6 h-6" /></Button>
              <Button size="icon" variant="ghost" className="text-white hover:text-white" onClick={e => { e.stopPropagation(); setSlideshowPlaying(!slideshowPlaying); }}>
                {slideshowPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>
              <Button size="icon" variant="ghost" className="text-white hover:text-white" onClick={e => { e.stopPropagation(); setSlideshowIndex(prev => (prev + 1) % filteredEvents.length); }}><SkipForward className="w-6 h-6" /></Button>
              <div className="w-32">
                <Slider value={[slideshowSpeed]} onValueChange={v => setSlideshowSpeed(v[0])} min={0.5} max={5} step={0.5} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-black/90 border border-white/[0.14] rounded-[1.25rem] w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-blue-400" /> Keyboard Shortcuts</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Present Play/Pause</span><kbd className="px-2 py-1 bg-white/10 rounded">Space</kbd></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Present Next</span><kbd className="px-2 py-1 bg-white/10 rounded">→ / ←</kbd></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Close Modal</span><kbd className="px-2 py-1 bg-white/10 rounded">Esc</kbd></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shortcuts</span><kbd className="px-2 py-1 bg-white/10 rounded">?</kbd></div>
            </div>
            <Button onClick={() => setShowKeyboardHelp(false)} variant="outline" className="w-full mt-6 rounded-full">Close</Button>
          </div>
        </div>
      )}
    </>
  );
}

export default EventsPage;
