import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Calendar, Camera, Filter, X, ChevronLeft, ChevronRight, Activity, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, subMonths, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { eventService } from '@/services/api/eventService';

interface SmartFiltersProps {
  cameras: string[];
  onFiltersChange?: (filters: FilterState) => void;
}

export interface FilterState {
  searchQuery: string;
  cameraId: string;
  detectionType: 'all' | 'motion' | 'person' | 'face' | 'vehicle';
  dateRange: { start: Date | undefined; end: Date | undefined };
  confidence: 'all' | 'high' | 'medium' | 'low';
  faceStatus: 'all' | 'has_faces' | 'known_faces' | 'unknown_faces' | 'no_faces';
  quickRange: 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'custom';
  timeOfDay: 'all' | 'morning' | 'afternoon' | 'evening' | 'night';
  personCount: 'all' | 'one' | 'two' | 'three_plus';
}

interface CalendarDayData {
  count: number;
  motion: number;
  face: number;
  persons: number;
  avgConfidence: number;
}

type QuickRangeOption = {
  label: string;
  value: FilterState['quickRange'];
  getDates: () => { start: Date; end: Date };
};

const quickRangeOptions: QuickRangeOption[] = [
  { label: 'All Time', value: 'all', getDates: () => ({ start: new Date(2020, 0, 1), end: new Date() }) },
  { label: 'Today', value: 'today', getDates: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Yesterday', value: 'yesterday', getDates: () => ({ start: new Date(Date.now() - 86400000), end: new Date(Date.now() - 86400000) }) },
  { label: 'Last 7 Days', value: 'last7days', getDates: () => ({ start: new Date(Date.now() - 7 * 86400000), end: new Date() }) },
  { label: 'Last 30 Days', value: 'last30days', getDates: () => ({ start: new Date(Date.now() - 30 * 86400000), end: new Date() }) },
  { label: 'This Month', value: 'thisMonth', getDates: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
];

const selectItemClass = "text-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground";
const selectContentClass = "bg-popover border-border text-foreground";
const selectTriggerClass = "bg-background border-input text-foreground placeholder:text-muted-foreground";

const timeOfDayOptions: { label: string; value: FilterState['timeOfDay']; hours: { start: number; end: number } }[] = [
  { label: 'Morning (6AM-12PM)', value: 'morning', hours: { start: 6, end: 12 } },
  { label: 'Afternoon (12PM-6PM)', value: 'afternoon', hours: { start: 12, end: 18 } },
  { label: 'Evening (6PM-10PM)', value: 'evening', hours: { start: 18, end: 22 } },
  { label: 'Night (10PM-6AM)', value: 'night', hours: { start: 22, end: 6 } },
];

const personCountOptions: { label: string; value: FilterState['personCount'] }[] = [
  { label: 'Any', value: 'all' },
  { label: '1 person', value: 'one' },
  { label: '2 people', value: 'two' },
  { label: '3+ people', value: 'three_plus' },
];

export const SmartFilters: React.FC<SmartFiltersProps> = ({
  cameras,
  onFiltersChange,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    cameraId: 'all',
    detectionType: 'all',
    dateRange: { start: undefined, end: undefined },
    confidence: 'all',
    faceStatus: 'all',
    quickRange: 'all',
    timeOfDay: 'all',
    personCount: 'all',
  });

  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData>>({});
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSearchRef = useRef<string>('');

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setIsFiltering(true);
    const newFilters = { ...filters, [key]: value };

    if (key === 'quickRange' && value !== 'custom') {
      const option = quickRangeOptions.find(o => o.value === value);
      if (option) {
        const dates = option.getDates();
        newFilters.dateRange = { start: dates.start, end: dates.end };
      }
    }

    setFilters(newFilters);

    const count = [
      newFilters.searchQuery,
      newFilters.cameraId !== 'all',
      newFilters.detectionType !== 'all',
      newFilters.quickRange !== 'all' && newFilters.quickRange !== 'custom',
      newFilters.dateRange.start && newFilters.dateRange.start && newFilters.quickRange === 'custom',
      newFilters.confidence !== 'all',
      newFilters.faceStatus !== 'all',
      newFilters.timeOfDay !== 'all',
      newFilters.personCount !== 'all',
    ].filter(Boolean).length;

    setActiveFilterCount(count);
    onFiltersChange?.(newFilters);

    if (key !== 'searchQuery') {
      setTimeout(() => setIsFiltering(false), 100);
    }
  };

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      debouncedSearchRef.current = value;
      setIsFiltering(true);
      const newFilters = { ...filters, searchQuery: value };
      setFilters(newFilters);

      const count = [
        newFilters.searchQuery,
        newFilters.cameraId !== 'all',
        newFilters.detectionType !== 'all',
        newFilters.quickRange !== 'all' && newFilters.quickRange !== 'custom',
        newFilters.dateRange.start && newFilters.dateRange.start && newFilters.quickRange === 'custom',
        newFilters.confidence !== 'all',
        newFilters.faceStatus !== 'all',
        newFilters.timeOfDay !== 'all',
        newFilters.personCount !== 'all',
      ].filter(Boolean).length;

      setActiveFilterCount(count);
      onFiltersChange?.(newFilters);
      setTimeout(() => setIsFiltering(false), 100);
    }, 300);
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debouncedSearchRef.current = '';

    const clearedFilters: FilterState = {
      searchQuery: '',
      cameraId: 'all',
      detectionType: 'all',
      dateRange: { start: undefined, end: undefined },
      confidence: 'all',
      faceStatus: 'all',
      quickRange: 'all',
      timeOfDay: 'all',
      personCount: 'all',
    };
    setFilters(clearedFilters);
    setActiveFilterCount(0);
    onFiltersChange?.(clearedFilters);
  }, [onFiltersChange]);

  const fetchCalendarData = useCallback(async () => {
    setLoadingCalendar(true);
    try {
      const result = await eventService.getCalendarStats(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        filters.cameraId === 'all' ? undefined : filters.cameraId
      );
      setCalendarData(result.data);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoadingCalendar(false);
    }
  }, [calendarMonth, filters.cameraId]);

  useEffect(() => {
    if (showCalendar) {
      fetchCalendarData();
    }
  }, [showCalendar, fetchCalendarData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        clearAllFilters();
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearAllFilters]);

  const getDayClasses = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    const isCurrentMonth = isSameMonth(day, calendarMonth);
    const isSelected = filters.dateRange.start && isSameDay(day, filters.dateRange.start);
    
    if (!isCurrentMonth) return 'opacity-30';
    
    if (dayData && dayData.count > 0) {
      const intensity = Math.min(dayData.count / 50, 1);
      if (isSelected) return 'bg-primary ring-2 ring-ring';
      if (isToday(day)) return 'bg-yellow-500 hover:bg-yellow-400 text-white';
      return `bg-primary/20 hover:bg-primary/30`;
    }
    
    if (isSelected) return 'bg-primary ring-2 ring-ring';
    if (isToday(day) && filters.quickRange === 'all') return 'bg-yellow-500 ring-2 ring-yellow-300 text-white';
    
    return 'hover:bg-accent';
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth)),
    end: endOfWeek(endOfMonth(calendarMonth)),
  });

  return (
    <div className="w-full p-3 md:p-4 border-b bg-background">
      {isFiltering && (
        <div className="mb-2 text-sm text-muted-foreground flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Applying filters...
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search events... (Ctrl+F)"
            defaultValue={filters.searchQuery}
            onChange={handleSearchChange}
            className="pl-10 h-11 min-h-[44px] text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="h-11 w-11 flex-shrink-0 md:hidden"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setFiltersCollapsed(!filtersCollapsed)}
          className="h-11 w-11 flex-shrink-0 hidden md:flex"
          title={filtersCollapsed ? "Expand filters" : "Collapse filters"}
        >
          {filtersCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      <div className={cn(
        "mt-3 flex flex-col gap-3 md:flex-row md:items-center md:gap-3",
        showFilters ? "flex" : "hidden md:flex",
        filtersCollapsed ? "hidden" : ""
      )}>
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <Select
            value={filters.quickRange}
            onValueChange={(value) => updateFilter('quickRange', value as FilterState['quickRange'])}
          >
            <SelectTrigger className="w-full md:w-40 h-11 min-h-[44px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              {quickRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.cameraId}
            onValueChange={(value) => updateFilter('cameraId', value)}
          >
            <SelectTrigger className="w-full md:w-36 h-11 min-h-[44px]">
              <Camera className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Cameras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
              {cameras.map((camera) => (
                <SelectItem key={camera} value={camera}>
                  {camera}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.detectionType}
            onValueChange={(value: string) => updateFilter('detectionType', value as FilterState['detectionType'])}
          >
            <SelectTrigger className="w-full md:w-32 h-11 min-h-[44px]">
              <Activity className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="motion">Motion</SelectItem>
              <SelectItem value="person">Person</SelectItem>
              <SelectItem value="face">Face</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full md:w-44 h-11 min-h-[44px] justify-start text-left font-normal',
                  filters.dateRange.start && filters.quickRange === 'custom' ? '' : 'text-muted-foreground'
                )}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {filters.dateRange.start && filters.quickRange === 'custom' ? (
                  <span>
                    {format(filters.dateRange.start, 'MMM d')} - {filters.dateRange.end ? format(filters.dateRange.end, 'MMM d') : '...'}
                  </span>
                ) : (
                  <span>Custom Date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {format(calendarMonth, 'MMMM yyyy')}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-7 gap-1 p-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-xs text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, i) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayData = calendarData[dateKey];
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!isSameMonth(day, calendarMonth)) {
                          setCalendarMonth(day);
                        }
                        if (filters.dateRange.start && !filters.dateRange.end) {
                          updateFilter('dateRange', { 
                            start: filters.dateRange.start > day ? day : filters.dateRange.start, 
                            end: filters.dateRange.start > day ? filters.dateRange.start : day 
                          });
                          updateFilter('quickRange', 'custom');
                        } else {
                          updateFilter('dateRange', { start: day, end: undefined });
                          updateFilter('quickRange', 'custom');
                        }
                        setShowCalendar(false);
                      }}
                      className={cn(
                        'relative h-9 w-9 rounded-lg text-sm',
                        getDayClasses(day),
                        !isSameMonth(day, calendarMonth) && 'opacity-30'
                      )}
                      disabled={!isSameMonth(day, calendarMonth)}
                    >
                      <span className={cn(
                        isToday(day) && !dayData ? 'font-bold text-yellow-600' : ''
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayData && dayData.count > 0 && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground">
                          {dayData.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <div className="p-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary/20" />
                  <span>Events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  <span>Today</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={filters.confidence}
            onValueChange={(value: string) => updateFilter('confidence', value as FilterState['confidence'])}
          >
            <SelectTrigger className="w-full md:w-32 h-11 min-h-[44px]">
              <SelectValue placeholder="Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="high">High (80%+)</SelectItem>
              <SelectItem value="medium">Medium (50-80%)</SelectItem>
              <SelectItem value="low">Low (&lt;50%)</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.faceStatus}
            onValueChange={(value: string) => updateFilter('faceStatus', value as FilterState['faceStatus'])}
          >
            <SelectTrigger className="w-full md:w-36 h-11 min-h-[44px]">
              <Users className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Faces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Faces</SelectItem>
              <SelectItem value="has_faces">Has Faces</SelectItem>
              <SelectItem value="known_faces">Known</SelectItem>
              <SelectItem value="unknown_faces">Unknown</SelectItem>
              <SelectItem value="no_faces">No Faces</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.timeOfDay}
            onValueChange={(value: FilterState['timeOfDay']) => updateFilter('timeOfDay', value)}
          >
            <SelectTrigger className="w-full md:w-40 h-11 min-h-[44px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time of Day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Times</SelectItem>
              {timeOfDayOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.personCount}
            onValueChange={(value: FilterState['personCount']) => updateFilter('personCount', value)}
          >
            <SelectTrigger className="w-full md:w-32 h-11 min-h-[44px]">
              <Users className="h-4 w-4 mr-2" />
              <SelectValue placeholder="People" />
            </SelectTrigger>
            <SelectContent>
              {personCountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <Badge variant="secondary">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </Badge>
          )}

          {activeFilterCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10"
              onClick={clearAllFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {filters.searchQuery && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('searchQuery', '')}>
              "{filters.searchQuery}"
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.quickRange !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('quickRange', 'all')}>
              {quickRangeOptions.find(o => o.value === filters.quickRange)?.label || 'Custom'}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.cameraId !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('cameraId', 'all')}>
              <Camera className="h-3 w-3 mr-1" />
              {filters.cameraId}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.detectionType !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('detectionType', 'all')}>
              <Activity className="h-3 w-3 mr-1" />
              {filters.detectionType}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.confidence !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('confidence', 'all')}>
              {filters.confidence}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.faceStatus !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('faceStatus', 'all')}>
              <Users className="h-3 w-3 mr-1" />
              {filters.faceStatus.replace('_', ' ')}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.timeOfDay !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('timeOfDay', 'all')}>
              <Clock className="h-3 w-3 mr-1" />
              {timeOfDayOptions.find(o => o.value === filters.timeOfDay)?.label.split(' ')[0] || filters.timeOfDay}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.personCount !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('personCount', 'all')}>
              <Users className="h-3 w-3 mr-1" />
              {personCountOptions.find(o => o.value === filters.personCount)?.label}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};