import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useCameras } from '@/contexts/CameraContext';
import { Calendar, Play, Pause, SkipBack, SkipForward, Clock, Users, UserCheck, Moon, ChevronLeft, ChevronRight, Filter, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { PageLoading } from '@/components/ui/PageLoading';
import { EmptyState } from '@/components/ui/EmptyState';
import apiService from '@/services/ApiService';
import { cn } from '@/lib/utils';

type CategoryFilter = 'all' | 'persons' | 'known' | 'unknown' | 'night';

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
  highlightScore: number;
  imageUrl: string;
  metadata: Record<string, unknown>;
}

interface DaySummary {
  totalEvents: number;
  totalPersons: number;
  totalFaces: number;
  knownFaces: number;
  nightEvents: number;
}

type SortOption = 'recent' | 'persons' | 'faces' | 'unknown' | 'confidence';

const DayHighlightsPage = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cameras } = useCameras();

  const [highlights, setHighlights] = useState<HighlightEvent[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentHighlight = highlights[currentIndex];
  const filteredHighlights = highlights.filter(h => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'persons') return h.personsDetected > 0;
    if (categoryFilter === 'known') return h.knownFacesCount > 0;
    if (categoryFilter === 'unknown') return h.unknownFacesCount > 0;
    if (categoryFilter === 'night') {
      const hour = new Date(h.timestamp).getHours();
      return hour >= 22 || hour <= 6;
    }
    return true;
  });

  const getCameraName = (cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    return camera?.name || `Camera ${cameraId}`;
  };

  const loadHighlights = useCallback(async () => {
    if (!date) return;

    setLoading(true);
    try {
      const [highlightsData, summaryData] = await Promise.all([
        apiService.getDayHighlights(date, { sort: sortBy }),
        apiService.getDaySummary(date)
      ]);

      if (highlightsData.success && highlightsData.highlights.length > 0) {
        // Always sort chronologically from 12:00 AM to end of day
        const sortedHighlights = [...highlightsData.highlights].sort((a, b) => {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
        
        // If viewing today, filter to only show events up to current time
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        if (date === today) {
          const filteredHighlights = sortedHighlights.filter(h => {
            return new Date(h.timestamp).getTime() <= now.getTime();
          });
          setHighlights(filteredHighlights);
        } else {
          setHighlights(sortedHighlights);
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
    if (isPlaying && highlights.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % highlights.length);
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
  }, [isPlaying, highlights.length, speed]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case KEYBOARD_SHORTCUTS.PLAY_PAUSE:
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case KEYBOARD_SHORTCUTS.PREV:
          e.preventDefault();
          goToPrevious();
          break;
        case KEYBOARD_SHORTCUTS.NEXT:
          e.preventDefault();
          goToNext();
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
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredHighlights.length]);

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev - 1 + highlights.length) % highlights.length);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % highlights.length);
  };

  const changeDate = (days: number) => {
    const currentDate = date ? new Date(date) : new Date();
    currentDate.setDate(currentDate.getDate() + days);
    const newDate = currentDate.toISOString().split('T')[0];
    navigate(`/app/highlights/${newDate}`);
  };

  const getCategoryLabel = (highlight: HighlightEvent) => {
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
    return { label: 'Motion', color: 'bg-slate-500/20 text-muted-foreground border-slate-500/30', icon: null };
  };

  const getCategoryInfo = (highlight: HighlightEvent) => {
    const info = getCategoryLabel(highlight);
    return info;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageLoading message="Loading Highlights..." />
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <PageHeader
            title="Day Highlights"
            subtitle={date ? formatDate(date) : 'Select a date'}
            icon={Calendar}
            backTo="/app/events"
            size="large"
          />
          <EmptyState
            icon={Calendar}
            title="No Highlights Found"
            description={`There were no events detected on ${date ? formatDate(date) : 'this date'}`}
            action={{ label: 'Previous Day', onClick: () => changeDate(-1) }}
          />
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={() => changeDate(1)} variant="outline">
              Next Day
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Day Highlights"
          subtitle={date ? formatDate(date) : 'Select a date'}
          icon={Calendar}
          backTo="/app/events"
          size="large"
          actions={
            <div className="flex gap-2">
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

        {/* Category Filters */}
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setCategoryFilter('all')}
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            size="sm"
          >
            All ({highlights.length})
          </Button>
          <Button
            onClick={() => setCategoryFilter('persons')}
            variant={categoryFilter === 'persons' ? 'default' : 'outline'}
            size="sm"
          >
            <Users className="w-3 h-3 mr-1" />
            Persons ({highlights.filter(h => h.personsDetected > 0).length})
          </Button>
          <Button
            onClick={() => setCategoryFilter('known')}
            variant={categoryFilter === 'known' ? 'default' : 'outline'}
            size="sm"
          >
            <UserCheck className="w-3 h-3 mr-1" />
            Known ({highlights.filter(h => h.knownFacesCount > 0).length})
          </Button>
          <Button
            onClick={() => setCategoryFilter('unknown')}
            variant={categoryFilter === 'unknown' ? 'default' : 'outline'}
            size="sm"
          >
            ? ({highlights.filter(h => h.unknownFacesCount > 0).length})
          </Button>
          <Button
            onClick={() => setCategoryFilter('night')}
            variant={categoryFilter === 'night' ? 'default' : 'outline'}
            size="sm"
          >
            <Moon className="w-3 h-3 mr-1" />
            Night ({highlights.filter(h => {
              const hour = new Date(h.timestamp).getHours();
              return hour >= 22 || hour <= 6;
            }).length})
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
            <Card className="bg-card border-border overflow-hidden">
              <div className="relative aspect-video bg-black">
                {currentHighlight?.imageUrl ? (
                  <img
                    src={currentHighlight.imageUrl}
                    alt={`Day highlight: ${currentHighlight.event_type || 'event'} from ${currentHighlight.cameraId}`}
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
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-card border-border p-4">
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
            </Card>

            <Card className="bg-card border-border p-4 max-h-96 overflow-y-auto">
              <h3 className="text-lg font-semibold text-foreground mb-4">Timeline</h3>
              <div className="space-y-2">
                {highlights.map((highlight, index) => {
                  const info = getCategoryInfo(highlight);
                  return (
                    <div
                      key={highlight.id}
                      onClick={() => setCurrentIndex(index)}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all',
                        index === currentIndex
                          ? 'bg-blue-500/20 border border-blue-500/30'
                          : 'hover:bg-muted border border-transparent'
                      )}
                    >
                      <img
                        src={highlight.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-16 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{formatTime(highlight.timestamp)}</div>
                        <div className="text-xs text-muted-foreground truncate">{getCameraName(highlight.cameraId)}</div>
                      </div>
                      <Badge className={cn('text-xs', info.color)}>
                        {info.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <Card className="bg-card border-border p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
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
          </Card>
        </div>
      )}
    </div>
  );
};

export default DayHighlightsPage;