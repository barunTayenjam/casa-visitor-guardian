import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { Calendar, Play, Pause, SkipBack, SkipForward, Clock, Users, User, UserCheck, Moon, ChevronLeft, ChevronRight, Filter, Keyboard, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { PageLoading } from '@/components/ui/PageLoading';
import { EmptyState } from '@/components/ui/EmptyState';
import { systemService } from '@/services/api/systemService';
import { cn } from '@/lib/utils';

type CategoryFilter = 'all' | 'persons' | 'known' | 'unknown' | 'night';
type TabView = 'highlights' | 'timelapse';

const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: ' ',
  PREV: 'ArrowLeft',
  NEXT: 'ArrowRight',
  FIRST: 'Home',
  LAST: 'End',
  FULLSCREEN: 'f',
  EXPORT: 'e',
  FILTER_ALL: '1',
  FILTER_PERSONS: '2',
  FILTER_KNOWN: '3',
  FILTER_UNKNOWN: '4',
};

interface HighlightEvent {
  id: string;
  filename: string;
  cameraId: string;
  timestamp: string;
  eventType: string;
  confidence: number;
  personsDetected: number;
  facesDetected: number;
  knownFacesCount: number;
  unknownFacesCount: number;
  objectDetections: Record<string, unknown>[];
  faceDetections: Record<string, unknown>[];
  imageUrl: string;
  metadata: Record<string, unknown>;
}

interface DaySummary {
  totalEvents: number;
  totalPersons: number;
  totalFaces: number;
  knownFaces: number;
  knownEvents: number;
  unknownEvents: number;
  nightEvents: number;
}

interface TimelapseEntry {
  cameraId: string;
  path: string;
}

type SortOption = 'recent' | 'persons' | 'faces' | 'unknown' | 'confidence';

interface TimelineListProps {
  highlights: HighlightEvent[];
  currentIndex: number;
  onSelect: (index: number) => void;
  getCategoryInfo: (highlight: HighlightEvent) => { label: string; color: string; icon: React.ReactNode };
  getCameraName: (cameraId: string) => string;
  formatTime: (timestamp: string) => string;
}

const TIMELINE_ROW_HEIGHT = 72;

const TimelineList: React.FC<TimelineListProps> = ({ highlights, currentIndex, onSelect, getCategoryInfo, getCameraName, formatTime }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: highlights.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TIMELINE_ROW_HEIGHT,
    overscan: 6,
  });

  useEffect(() => {
    if (currentIndex < 0 || currentIndex >= highlights.length) return;
    const range = virtualizer.range;
    if (!range || currentIndex < range.startIndex || currentIndex >= range.endIndex) {
      virtualizer.scrollToIndex(currentIndex, { align: 'center' });
    }
  }, [currentIndex, highlights.length, virtualizer]);

  return (
    <div ref={scrollRef} className="bezel-inner max-h-96 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-lg font-semibold text-foreground mb-3">Timeline</h3>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const highlight = highlights[vItem.index];
            if (!highlight) return null;
            const info = getCategoryInfo(highlight);
            const isCurrent = vItem.index === currentIndex;
            return (
              <div
                key={highlight.id}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                onClick={() => onSelect(vItem.index)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vItem.start}px)`,
                }}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-[0.375rem] cursor-pointer transition-colors',
                  isCurrent
                    ? 'bg-blue-500/20 border border-blue-500/30'
                    : 'hover:bg-muted border border-transparent'
                )}
              >
                <img
                  src={highlight.imageUrl}
                  alt=""
                  loading="lazy"
                  className="w-16 h-12 object-cover rounded flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{formatTime(highlight.timestamp)}</div>
                  <div className="text-xs text-muted-foreground truncate">{getCameraName(highlight.cameraId)}</div>
                </div>
                <Badge className={cn('text-xs flex-shrink-0', info.color)}>
                  {info.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TimelapseTab: React.FC<{ date: string; getCameraName: (id: string) => string }> = ({ date, getCameraName }) => {
  const [list, setList] = useState<TimelapseEntry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setLoading(true);
    setActive(null);
    setList([]);
    systemService.getTimelapses(date)
      .then((res) => {
        if (res.success && res.timelapses.length > 0) {
          setList(res.timelapses);
          setActive(res.timelapses[0].cameraId);
        }
      })
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading timelapses…</div>;
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Film}
        title="No Timelapse"
        description={`No daily timelapse generated for ${date}. Timelapse is recorded between 00:05 and 24:00 and saved at midnight.`}
      />
    );
  }

  const src = list.find((t) => t.cameraId === active)?.path;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {list.map((t) => (
          <Button
            key={t.cameraId}
            onClick={() => setActive(t.cameraId)}
            variant={t.cameraId === active ? 'default' : 'outline'}
            size="sm"
          >
            <Film className="w-3 h-3 mr-1" />
            {getCameraName(t.cameraId)}
          </Button>
        ))}
      </div>
      <div className="bezel">
        <div className="bezel-inner overflow-hidden">
          <div className="relative aspect-video bg-black">
            {src ? (
              <video
                ref={videoRef}
                key={src}
                src={src}
                controls
                autoPlay
                loop
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a camera
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              2-minute timelapse of the full day at 24 fps. Captured 1 frame every 30 seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const DayHighlightsPage = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cameras } = useCameras();

  const [tab, setTab] = useState<TabView>('highlights');
  const [highlights, setHighlights] = useState<HighlightEvent[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const filterCounts = useMemo(() => ({
    all: summary?.totalEvents ?? highlights.length,
    persons: summary?.totalEvents ?? highlights.length,
    known: summary?.knownEvents ?? 0,
    unknown: summary?.unknownEvents ?? 0,
    night: summary?.nightEvents ?? 0,
  }), [summary, highlights.length]);
  const filteredHighlights = useMemo(() => highlights.filter(h => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'persons') return h.personsDetected > 0;
    if (categoryFilter === 'known') return h.knownFacesCount > 0;
    if (categoryFilter === 'unknown') return h.unknownFacesCount > 0;
    if (categoryFilter === 'night') {
      const hour = new Date(h.timestamp).getHours();
      return hour >= 22 || hour <= 6;
    }
    return true;
  }), [highlights, categoryFilter]);
  const currentHighlight = filteredHighlights[currentIndex];

  useEffect(() => {
    setCurrentIndex(0);
  }, [categoryFilter]);

  const getCameraName = useCallback((cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    return camera?.name || `Camera ${cameraId}`;
  }, [cameras]);

  const loadHighlights = useCallback(async () => {
    if (!date) return;

    setLoading(true);
    try {
      const [highlightsData, summaryData] = await Promise.all([
        systemService.getDayHighlights(date, { sort: sortBy }),
        systemService.getDaySummary(date)
      ]);

      if (highlightsData.success && highlightsData.highlights.length > 0) {
        let processedHighlights = [...highlightsData.highlights];
        const seenImages = new Set<string>();
        processedHighlights = processedHighlights.filter(h => {
          const key = h.imageUrl || h.id;
          if (seenImages.has(key)) return false;
          seenImages.add(key);
          return true;
        });
        if (sortBy === 'recent') {
          processedHighlights.sort((a, b) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          });
        }

        // If viewing today, filter to only show events up to current time
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        if (date === today) {
          processedHighlights = processedHighlights.filter(h => {
            return new Date(h.timestamp).getTime() <= now.getTime();
          });
          setHighlights(processedHighlights);
        } else {
          setHighlights(processedHighlights);
        }
        setCurrentIndex(0);
      } else {
        toast({
          title: 'No Highlights',
          description: `No events found for ${date}`,
          variant: 'destructive',
        });
      }

      if (summaryData.success) {
        setSummary(summaryData.summary);
      }
    } catch (error) {
      console.error('Failed to load highlights:', error);
      toast({
        title: 'Error',
        description: 'Failed to load highlights',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [date, sortBy, toast]);

  useEffect(() => {
    loadHighlights();
  }, [loadHighlights]);

  useEffect(() => {
    if (isPlaying && filteredHighlights.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % filteredHighlights.length);
      }, speed * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, filteredHighlights.length, speed]);

  // Preload next N slideshow images so advancement is instant
  const preloadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    preloadedRef.current.clear();
  }, [date]);
  useEffect(() => {
    if (filteredHighlights.length === 0) return;
    const N = 6;
    for (let i = 1; i <= N; i++) {
      const idx = (currentIndex + i) % filteredHighlights.length;
      const url = filteredHighlights[idx]?.imageUrl;
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }, [currentIndex, filteredHighlights]);

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case KEYBOARD_SHORTCUTS.PLAY_PAUSE:
        e.preventDefault();
        setIsPlaying(prev => !prev);
        break;
      case KEYBOARD_SHORTCUTS.PREV:
        e.preventDefault();
        setCurrentIndex(prev => (prev - 1 + filteredHighlights.length) % filteredHighlights.length);
        break;
      case KEYBOARD_SHORTCUTS.NEXT:
        e.preventDefault();
        setCurrentIndex(prev => (prev + 1) % filteredHighlights.length);
        break;
      case KEYBOARD_SHORTCUTS.FIRST:
        e.preventDefault();
        setCurrentIndex(0);
        break;
      case KEYBOARD_SHORTCUTS.LAST:
        e.preventDefault();
        setCurrentIndex(filteredHighlights.length - 1);
        break;
      case KEYBOARD_SHORTCUTS.FILTER_ALL:
        e.preventDefault();
        setCategoryFilter('all');
        break;
      case KEYBOARD_SHORTCUTS.FILTER_PERSONS:
        e.preventDefault();
        setCategoryFilter('persons');
        break;
      case KEYBOARD_SHORTCUTS.FILTER_KNOWN:
        e.preventDefault();
        setCategoryFilter('known');
        break;
      case KEYBOARD_SHORTCUTS.FILTER_UNKNOWN:
        e.preventDefault();
        setCategoryFilter('unknown');
        break;
      case KEYBOARD_SHORTCUTS.FULLSCREEN:
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        break;
      case KEYBOARD_SHORTCUTS.EXPORT:
        e.preventDefault();
        toast({
          title: 'Export',
          description: 'Export feature coming soon',
        });
        break;
      case '?':
        e.preventDefault();
        setShowKeyboardHelp(prev => !prev);
        break;
    }
  }, [filteredHighlights.length, toast]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev - 1 + filteredHighlights.length) % filteredHighlights.length);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % filteredHighlights.length);
  };

  const changeDate = (days: number) => {
    const currentDate = date ? new Date(date) : new Date();
    currentDate.setDate(currentDate.getDate() + days);
    const newDate = currentDate.toISOString().split('T')[0];
    navigate(`/app/highlights/${newDate}`);
  };

  const getCategoryInfo = useCallback((highlight: HighlightEvent) => {
    const hour = new Date(highlight.timestamp).getHours();
    if (highlight.knownFacesCount > 0) {
      return { label: 'Familiar Face', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <UserCheck className="w-4 h-4" /> };
    }
    if (highlight.unknownFacesCount > 0) {
      return { label: 'Unknown Face', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <UserCheck className="w-4 h-4" /> };
    }
    if (highlight.personsDetected > 1) {
      return { label: `${highlight.personsDetected} People`, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Users className="w-4 h-4" /> };
    }
    if (highlight.personsDetected === 1) {
      return { label: 'Person Detected', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Users className="w-4 h-4" /> };
    }
    if (hour >= 22 || hour <= 6) {
      return { label: 'Night Activity', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Moon className="w-4 h-4" /> };
    }
    return { label: 'Motion', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: null };
  }, []);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  if (loading && tab === 'highlights') {
    return (
      <div className="min-h-[100dvh] bg-background">
        <PageLoading message="Loading Highlights..." />
      </div>
    );
  }

  if (tab === 'highlights' && highlights.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <PageHeader
            title="Day Highlights"
            subtitle={date ? formatDate(date) : 'Select a date'}
            icon={Calendar}
            backTo="/app/events"
            size="large"
            actions={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  onClick={() => setTab('timelapse')}
                  variant="outline"
                  size="sm"
                >
                  <Film className="w-3 h-3 mr-1" />
                  Timelapse
                </Button>
                <Button
                  onClick={() => setTab('highlights')}
                  variant="default"
                  size="sm"
                >
                  Highlights
                </Button>
                <Button onClick={() => changeDate(-1)} variant="outline" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev
                </Button>
                <Button onClick={() => changeDate(1)} variant="outline" size="sm">
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            }
          />
          <EmptyState
            icon={Calendar}
            title="No Highlights Found"
            description={`There were no events detected on ${date ? formatDate(date) : 'this date'}`}
            action={{ label: 'Previous Day', onClick: () => changeDate(-1) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Day Highlights"
          subtitle={date ? formatDate(date) : 'Select a date'}
          icon={Calendar}
          backTo="/app/events"
          size="large"
          actions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                onClick={() => setTab('highlights')}
                variant={tab === 'highlights' ? 'default' : 'outline'}
                size="sm"
              >
                Highlights
              </Button>
              <Button
                onClick={() => setTab('timelapse')}
                variant={tab === 'timelapse' ? 'default' : 'outline'}
                size="sm"
              >
                <Film className="w-3 h-3 mr-1" />
                Timelapse
              </Button>
              {tab === 'highlights' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => setShowKeyboardHelp(true)} variant="outline" size="sm">
                        <Keyboard className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {tab === 'highlights' && (
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recent</SelectItem>
                    <SelectItem value="persons">Most People</SelectItem>
                    <SelectItem value="faces">Most Faces</SelectItem>
                    <SelectItem value="unknown">Unknown Faces</SelectItem>
                    <SelectItem value="confidence">High Confidence</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button onClick={() => changeDate(-1)} variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button onClick={() => changeDate(1)} variant="outline" size="sm">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          }
        />

        {tab === 'timelapse' && date && (
          <TimelapseTab date={date} getCameraName={getCameraName} />
        )}

        {tab === 'highlights' && (
          <>
            {/* Category Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button
                onClick={() => setCategoryFilter('all')}
                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
              >
                All ({filterCounts.all})
              </Button>
              <Button
                onClick={() => setCategoryFilter('persons')}
                variant={categoryFilter === 'persons' ? 'default' : 'outline'}
                size="sm"
              >
                <Users className="w-3 h-3 mr-1" />
                Persons ({filterCounts.persons})
              </Button>
              <Button
                onClick={() => setCategoryFilter('known')}
                variant={categoryFilter === 'known' ? 'default' : 'outline'}
                size="sm"
              >
                <UserCheck className="w-3 h-3 mr-1" />
                Known ({filterCounts.known})
              </Button>
              <Button
                onClick={() => setCategoryFilter('unknown')}
                variant={categoryFilter === 'unknown' ? 'default' : 'outline'}
                size="sm"
              >
                <User className="w-3 h-3 mr-1" />
                Unknown ({filterCounts.unknown})
              </Button>
              <Button
                onClick={() => setCategoryFilter('night')}
                variant={categoryFilter === 'night' ? 'default' : 'outline'}
                size="sm"
              >
                <Moon className="w-3 h-3 mr-1" />
                Night ({filterCounts.night})
              </Button>
            </div>

            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <StatCard icon={Calendar} label="Total Events" value={summary.totalEvents} />
                <StatCard icon={Users} iconColor="text-blue-500" label="Persons" value={summary.totalPersons} />
                <StatCard icon={UserCheck} iconColor="text-green-500" label="Known Faces" value={summary.knownFaces} />
                <StatCard icon={Moon} iconColor="text-purple-500" label="Night Events" value={summary.nightEvents} />
                <StatCard icon={Calendar} iconColor="text-orange-500" label="Highlights" value={highlights.length} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bezel">
                  <div className="bezel-inner overflow-hidden">
                    <div className="relative aspect-video bg-black">
                    {currentHighlight?.imageUrl ? (
                      <img
                        src={currentHighlight.imageUrl}
                        alt={`Day highlight: ${currentHighlight.eventType || 'event'} from ${currentHighlight.cameraId}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No image available
                      </div>
                    )}
                    {currentHighlight && (
                      <div className="absolute top-4 left-4">
                        <Badge className={cn('flex items-center gap-1', getCategoryInfo(currentHighlight).color)}>
                          {getCategoryInfo(currentHighlight).icon}
                          <span className="ml-1">{getCategoryInfo(currentHighlight).label}</span>
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{getCameraName(currentHighlight?.cameraId || '')}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {currentHighlight && formatTime(currentHighlight.timestamp)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={goToPrevious} variant="outline" size="icon">
                          <SkipBack className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => setIsPlaying(!isPlaying)} variant={isPlaying ? 'default' : 'outline'} size="icon">
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button onClick={goToNext} variant="outline" size="icon">
                          <SkipForward className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Speed</span>
                        <span className="text-foreground">{speed}s</span>
                      </div>
                      <Slider
                        value={[speed]}
                        onValueChange={(value) => setSpeed(value[0])}
                        min={0.3}
                        max={5}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{currentIndex + 1} of {filteredHighlights.length} (filtered from {highlights.length})</span>
                      <span className="text-xs text-muted-foreground">Press ? for keyboard shortcuts</span>
                    </div>
                  </div>
                 </div>
               </div>
              </div>

              <div className="space-y-4">
                <div className="bezel">
                  <div className="bezel-inner p-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Event Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Confidence</span>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {Math.round(currentHighlight?.confidence || 0)}%
                      </Badge>
                    </div>
                    {currentHighlight?.personsDetected > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Persons
                        </span>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          {currentHighlight.personsDetected}
                        </Badge>
                      </div>
                    )}
                    {currentHighlight?.facesDetected > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Faces</span>
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                          {currentHighlight.facesDetected}
                        </Badge>
                      </div>
                    )}
                    {currentHighlight?.knownFacesCount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          Known
                        </span>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          {currentHighlight.knownFacesCount}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                </div>

                <div className="bezel">
                  <TimelineList
                    highlights={filteredHighlights}
                    currentIndex={currentIndex}
                    onSelect={setCurrentIndex}
                    getCategoryInfo={getCategoryInfo}
                    getCameraName={getCameraName}
                    formatTime={formatTime}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bezel">
            <div className="bezel-inner p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Play / Pause</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">Space</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous Event</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">←</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Event</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">→</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First Event</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">Home</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Event</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">End</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filter: All</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">1</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filter: Persons</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">2</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filter: Known</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">3</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filter: Unknown</span>
                <kbd className="px-2 py-1 bg-muted rounded text-foreground">4</kbd>
              </div>
            </div>
            <Button onClick={() => setShowKeyboardHelp(false)} variant="outline" className="w-full mt-4">
              Close
            </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayHighlightsPage;
