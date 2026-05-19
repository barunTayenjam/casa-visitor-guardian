import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Calendar, Camera, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, subMonths, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { eventService } from '@/services/api/eventService';

interface SmartFiltersProps {
  cameras: string[];
  onFiltersChange?: (filters: FilterState) => void;
}

export interface FilterState {
  cameraId: string;
  detectionType: 'all' | 'motion' | 'person' | 'face' | 'vehicle';
  dateRange: { start: Date | undefined; end: Date | undefined };
  quickRange: 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days';
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
];

interface CalendarDayData {
  count: number;
  motion: number;
  face: number;
  persons: number;
  avgConfidence: number;
}

export const SmartFilters: React.FC<SmartFiltersProps> = ({
  cameras,
  onFiltersChange,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    cameraId: 'all',
    detectionType: 'all',
    dateRange: { start: undefined, end: undefined },
    quickRange: 'all',
  });

  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Record<string, CalendarDayData>>({});
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const updateFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    const newFilters = { ...filters, [key]: value };

    if (key === 'quickRange' && value !== 'all' && value !== 'custom') {
      const option = quickRangeOptions.find(o => o.value === value);
      if (option) {
        const dates = option.getDates();
        newFilters.dateRange = { start: dates.start, end: dates.end };
      }
    } else if (key === 'quickRange' && value === 'all') {
      newFilters.dateRange = { start: undefined, end: undefined };
    }

    setFilters(newFilters);

    const count = [
      newFilters.cameraId !== 'all',
      newFilters.detectionType !== 'all',
      newFilters.quickRange !== 'all',
      newFilters.dateRange.start && newFilters.dateRange.start,
    ].filter(Boolean).length;

    setActiveFilterCount(count);
    onFiltersChange?.(newFilters);
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    const clearedFilters: FilterState = {
      cameraId: 'all',
      detectionType: 'all',
      dateRange: { start: undefined, end: undefined },
      quickRange: 'all',
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

  const getDayClasses = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    const isCurrentMonth = isSameMonth(day, calendarMonth);
    const isSelected = filters.dateRange.start && isSameDay(day, filters.dateRange.start);

    if (!isCurrentMonth) return 'opacity-30';

    if (dayData && dayData.count > 0) {
      if (isSelected) return 'bg-primary ring-2 ring-ring';
      if (isToday(day)) return 'bg-yellow-500 hover:bg-yellow-400 text-white';
      return 'bg-primary/20 hover:bg-primary/30';
    }

    if (isSelected) return 'bg-primary ring-2 ring-ring';
    if (isToday(day) && filters.quickRange === 'all') return 'bg-yellow-500 ring-2 ring-yellow-300 text-white';

    return 'hover:bg-accent';
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth)),
    end: endOfWeek(endOfMonth(calendarMonth)),
  });

  const handleCalendarDayClick = (day: Date) => {
    if (!isSameMonth(day, calendarMonth)) {
      setCalendarMonth(day);
    }
    if (filters.dateRange.start && !filters.dateRange.end) {
      const start = filters.dateRange.start > day ? day : filters.dateRange.start;
      const end = filters.dateRange.start > day ? filters.dateRange.start : day;
      updateFilter('dateRange', { start, end });
      updateFilter('quickRange', 'all');
    } else {
      updateFilter('dateRange', { start: day, end: undefined });
      updateFilter('quickRange', 'all');
    }
    setShowCalendar(false);
  };

  return (
    <div className="w-full p-3 md:p-4 border-b bg-background">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Select
            value={filters.quickRange}
            onValueChange={(value) => updateFilter('quickRange', value as FilterState['quickRange'])}
          >
            <SelectTrigger className="w-full md:w-36 h-10">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              {quickRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.cameraId}
            onValueChange={(value) => updateFilter('cameraId', value)}
          >
            <SelectTrigger className="w-full md:w-36 h-10">
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
            <SelectTrigger className="w-full md:w-32 h-10">
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
        </div>

        <div className="flex items-center gap-2">
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-10 px-3',
                  filters.dateRange.start ? '' : 'text-muted-foreground'
                )}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {filters.dateRange.start ? (
                  <span className="text-sm">
                    {format(filters.dateRange.start, 'MMM d')}
                    {filters.dateRange.end ? ` - ${format(filters.dateRange.end, 'MMM d')}` : ''}
                  </span>
                ) : (
                  <span className="text-sm">Calendar</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 border-b flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {format(calendarMonth, 'MMMM yyyy')}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                >
                  <ChevronUp className="h-4 w-4" />
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
                      onClick={() => handleCalendarDayClick(day)}
                      className={cn(
                        'relative h-8 w-8 rounded text-sm',
                        getDayClasses(day),
                        !isSameMonth(day, calendarMonth) && 'opacity-30'
                      )}
                      disabled={!isSameMonth(day, calendarMonth)}
                    >
                      {format(day, 'd')}
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

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="h-10 w-10 md:hidden"
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 text-muted-foreground"
              onClick={clearAllFilters}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {filters.quickRange !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('quickRange', 'all')}>
              {quickRangeOptions.find(o => o.value === filters.quickRange)?.label}
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
              {filters.detectionType}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.dateRange.start && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => updateFilter('dateRange', { start: undefined, end: undefined })}>
              <Calendar className="h-3 w-3 mr-1" />
              {format(filters.dateRange.start, 'MMM d')}
              {filters.dateRange.end ? ` - ${format(filters.dateRange.end, 'MMM d')}` : ''}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};