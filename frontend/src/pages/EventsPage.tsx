import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { MotionEvent } from '@/types/security';
import { EventTimeline } from '@/components/events/EventTimeline';
import { SmartFilters, FilterState } from '@/components/events/SmartFilters';
import { EventDetailPanel } from '@/components/events/EventDetailPanel';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { Calendar, Clock, User, Grid, List, Archive, Download, Brain } from 'lucide-react';
import { colors } from '@/styles/design-tokens';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { eventService } from '@/services/api/eventService';
import { detectionService } from '@/services/api/detectionService';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'confidence';

interface ApiEvent {
  id: string;
  cameraId: string;
  cameraName?: string;
  timestamp: string;
  imageUrl?: string;
  filename?: string;
  confidence: number;
  event_type: string;
  metadata: Record<string, unknown>;
  labels?: string[];
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  unknown_faces_count: number;
  object_detections: unknown[];
  face_detections: unknown[];
}

const EventsPage = () => {
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

  // Bulk selection state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Analysis state - store analysis per event ID
  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);
  const [analysisByEvent, setAnalysisByEvent] = useState<Record<string, {
    sceneDescription?: string;
    summary?: string;
    threatAssessment?: { level: string; factors: string[]; confidence: number };
    detectedEntities?: { people: string[]; vehicles: string[]; animals: string[]; objects: string[] };
    recommendedActions?: string[];
    processingTime?: number;
    modelUsed?: string;
    overall_summary?: string;
    activities?: string[];
    persons?: Record<string, unknown>[];
    vehicles?: Record<string, unknown>[];
  }>>({});

  const handleAnalyzeEvent = async (eventId: string) => {
    setAnalyzingEventId(eventId);
    try {
      const result = await detectionService.analyzeEvent(eventId);
      if (result.success && result.analysis) {
        setAnalysisByEvent(prev => ({ ...prev, [eventId]: {
          sceneDescription: result.analysis?.overall_summary || result.analysis?.summary || '',
          summary: result.analysis?.summary,
          persons: (result.analysis?.persons || []) as Record<string, unknown>[],
          vehicles: (result.analysis?.vehicles || []) as Record<string, unknown>[],
        } }));
        toast({
          title: 'AI Analysis Complete',
          description: result.analysis?.overall_summary || result.analysis?.summary || 'Analysis complete',
          variant: 'default',
        });
        loadEvents();
      } else {
        toast({
          title: 'Analysis Failed',
          description: result.message || 'Unknown error',
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
  };

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;
  const cameraNames = cameras.map(c => c.name);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const pageSize = viewMode === 'grid' ? 100 : 100;
      const response = await eventService.getEnhancedEventsList({
        page: currentPage,
        pageSize: pageSize,
        camera_id: filters.cameraId === 'all' ? undefined : filters.cameraId,
        start_date: filters.dateRange.start?.toISOString(),
        end_date: filters.dateRange.end?.toISOString(),
        event_type: filters.detectionType === 'all' ? undefined : filters.detectionType,
        searchQuery: filters.searchQuery || undefined,
        sortBy: sortBy,
      });

      const transformedEvents = response.events.map((event: ApiEvent): MotionEvent => ({
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
      await eventService.archiveEvent(eventId);
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

  // Bulk selection handlers
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      setShowBulkActions(newSet.size > 0);
      return newSet;
    });
  };

  const selectAllEvents = () => {
    if (selectedEventIds.size === events.length) {
      setSelectedEventIds(new Set());
      setShowBulkActions(false);
    } else {
      const allIds = new Set(events.map(e => e.id));
      setSelectedEventIds(allIds);
      setShowBulkActions(true);
    }
  };

  const clearSelection = () => {
    setSelectedEventIds(new Set());
    setShowBulkActions(false);
  };

  const bulkDelete = async () => {
    if (selectedEventIds.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedEventIds.size} events?`);
    if (!confirmed) return;

    try {
      const deletePromises = Array.from(selectedEventIds).map(id => eventService.archiveEvent(id));
      await Promise.all(deletePromises);
      toast({
        title: 'Events Deleted',
        description: `${selectedEventIds.size} events have been deleted.`,
      });
      clearSelection();
      loadEvents();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete some events',
        variant: 'destructive',
      });
    }
  };

  const bulkExport = () => {
    if (selectedEventIds.size === 0) return;
    
    const selectedEvents = events.filter(e => selectedEventIds.has(e.id));
    const exportData = selectedEvents.map(e => ({
      id: e.id,
      cameraId: e.cameraId,
      timestamp: e.timestamp.toISOString(),
      confidence: e.confidence,
      labels: e.labels,
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `events_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    toast({
      title: 'Exported',
      description: `${selectedEventIds.size} events exported to JSON.`,
    });
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
      // Ctrl+A: Select all
      if (e.ctrlKey && e.key === 'a' && !selectedEventId) {
        e.preventDefault();
        selectAllEvents();
        return;
      }
      
      if (e.key === 'Escape') {
        if (showBulkActions) {
          clearSelection();
        } else {
          setSelectedEventId(null);
        }
      } else if (selectedEventId) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPreviousEvent();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextEvent();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, filteredEvents, selectedEvent, showBulkActions]);

  const stats = {
    total: totalEvents,
    today: events.filter(e => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return e.timestamp >= today;
    }).length,
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Events</h1>
            <p className="text-sm text-muted-foreground">Browse and manage security events</p>
          </div>
          <div className="flex items-center gap-3">
              {/* Inline stats */}
              <div className="hidden md:flex items-center gap-3 mr-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm text-muted-foreground">{stats.total} total</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-muted-foreground">{stats.today} today</span>
                </div>
              </div>
              {/* Bulk Actions */}
              {showBulkActions ? (
                <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-lg px-3 py-1">
                  <span className="text-sm text-foreground">
                    {selectedEventIds.size} selected
                  </span>
                  <Button
                    size="default"
                    variant="ghost"
                    onClick={selectAllEvents}
                    className="text-muted-foreground hover:text-foreground h-10 min-h-[40px] px-3 text-sm"
                  >
                    {selectedEventIds.size === events.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    size="default"
                    variant="ghost"
                    onClick={bulkExport}
                    className="text-muted-foreground hover:text-foreground h-10 min-h-[40px] px-3 text-sm"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  <Button
                    size="default"
                    variant="ghost"
                    onClick={bulkDelete}
                    className="text-red-400 hover:text-red-300 h-10 min-h-[40px] px-3 text-sm"
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button
                    size="default"
                    variant="ghost"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:text-foreground h-10 min-h-[40px] w-10 p-0"
                    aria-label="Clear selection"
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <Button
                  size="default"
                  variant="outline"
                  onClick={() => setShowBulkActions(true)}
                  className="text-muted-foreground hover:text-foreground h-10 min-h-[40px] text-sm"
                >
                  Select
                </Button>
              )}
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1 border border-border">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
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
                  <div className="aspect-video bg-muted rounded-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted/50 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Events Found"
              description="Try adjusting your filters or check back later"
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.id}
                    className={cn(
                      'relative rounded-xl overflow-hidden cursor-pointer bg-card',
                      'transition-all duration-300',
                      'hover:shadow-xl hover:scale-[1.02]',
                      'hover:ring-2 hover:ring-white/20',
                      selectedEventId === event.id && 'ring-2 ring-blue-500 shadow-xl',
                      'group'
                    )}
                    style={{
                      animationDelay: `${index * 30}ms`,
                    }}
                  onClick={() => handleEventSelect(event.id)}
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {event.imageUrl ? (
                      <ProgressiveImage
                        src={event.imageUrl}
                        alt={`Motion event: ${event.labels?.[0] || 'detection'} on ${event.cameraName}`}
                        className="w-full h-full"
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
                    <div className="absolute bottom-2 right-2 z-10">
                      {analysisByEvent[event.id] ? (
                        <div className="px-2 py-1 rounded text-xs font-medium bg-green-600/80 text-white shadow-lg flex items-center gap-1">
                          <Brain className="h-3 w-3" />
                          Done
                        </div>
                      ) : (
                        <Button
size="sm"
                    variant="ghost"
                    className={cn(
                      "h-9 w-9 p-0 flex-shrink-0",
                      analysisByEvent[event.id] ? "text-green-400" : ""
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!analysisByEvent[event.id]) {
                        handleAnalyzeEvent(event.id);
                      }
                    }}
                    disabled={analyzingEventId === event.id || !!analysisByEvent[event.id]}
                    title={analysisByEvent[event.id] ? "Already analyzed" : "AI Analyze"}
                  >
                    {analyzingEventId === event.id ? (
                      <span className="h-3 w-3 animate-spin">↻</span>
                    ) : analysisByEvent[event.id] ? (
                      <Brain className="h-4 w-4" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                  </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-400 transition-colors">
                          {event.cameraName}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
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
                      'flex items-center gap-4 p-3 rounded-xl cursor-pointer bg-card',
                      'transition-all duration-300',
                      'hover:shadow-lg hover:scale-[1.01]',
                      'hover:ring-2 hover:ring-white/10',
                      selectedEventId === event.id && 'ring-2 ring-blue-500 shadow-lg bg-blue-500/5',
                      'group'
                    )}
                  onClick={() => handleEventSelect(event.id)}
                >
                   <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                    {event.imageUrl ? (
                      <ProgressiveImage
                        src={event.imageUrl}
                        alt={`Motion event: ${event.labels?.[0] || 'detection'} on ${event.cameraName}`}
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-xs text-white/30">No image</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-400 transition-colors">
                        {event.cameraName}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {event.labels && event.labels.length > 0 && (
                          <div className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: `${colors.detection[event.labels[0] as keyof typeof colors.detection] || colors.detection.motion}DD` }}>
                            {event.labels[0]}
                          </div>
                        )}
                        {event.confidence > 0 && (
                          <div className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                            {Math.round(event.confidence * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-9 w-9 p-0 flex-shrink-0",
                      analysisByEvent[event.id] && "text-green-400"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!analysisByEvent[event.id]) {
                        handleAnalyzeEvent(event.id);
                      }
                    }}
                    disabled={analyzingEventId === event.id || !!analysisByEvent[event.id]}
                    title={analysisByEvent[event.id] ? "Already analyzed" : "AI Analyze"}
                  >
                    {analyzingEventId === event.id ? (
                      <span className="h-3 w-3 animate-spin">↻</span>
                    ) : analysisByEvent[event.id] ? (
                      <span className="text-xs font-bold">✓</span>
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={currentPage === 1 ? undefined : () => handlePageChange(currentPage - 1)}
                      className={cn(
                        "h-11 min-h-[44px] w-11 cursor-pointer",
                        currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                      )}
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
                          <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">...</span>
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={pageNum}>
                          <PaginationLink 
                            onClick={() => handlePageChange(pageNum as number)}
                            isActive={pageNum === currentPage}
                            className="h-11 min-h-[44px] w-11 cursor-pointer"
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
                      className={cn(
                        "h-11 min-h-[44px] w-11 cursor-pointer",
                        currentPage === totalPages ? 'pointer-events-none opacity-50' : ''
                      )}
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
              analysis={selectedEvent ? analysisByEvent[selectedEvent.id] : null}
            />
            <div className="w-full md:w-[500px] lg:w-[600px] border-t border-border overflow-y-auto">
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
