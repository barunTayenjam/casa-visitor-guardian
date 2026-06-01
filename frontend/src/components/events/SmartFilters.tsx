import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Calendar, Camera, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, subMonths, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { eventService } from '@/services/api/eventService';

export interface FilterState {
  cameraId: string;
  detectionType: 'all' | 'motion' | 'person' | 'face' | 'vehicle';
  dateRange: { start: Date | undefined; end: Date | undefined };
  quickRange: 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days';
}

interface SmartFiltersProps {
  cameras: {id: string; name: string}[];
  filters: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
}

type QuickRangeOption = {
  label: string; value: FilterState['quickRange'];
  getDates: () => { start: Date; end: Date };
};

function normalizeToISTBoundary(date: Date, type: 'start' | 'end'): Date {
  const d = new Date(date);
  d.setHours(type === 'start' ? 0 : 23, type === 'start' ? 0 : 59, type === 'start' ? 0 : 59, type === 'start' ? 0 : 999);
  return d;
}

const quickRangeOptions: QuickRangeOption[] = [
  { label: 'All Time', value: 'all', getDates: () => ({ start: undefined as unknown as Date, end: undefined as unknown as Date }) },
  { label: 'Today', value: 'today', getDates: () => ({ start: normalizeToISTBoundary(new Date(), 'start'), end: normalizeToISTBoundary(new Date(), 'end') }) },
  { label: 'Yesterday', value: 'yesterday', getDates: () => {
    const yesterday = new Date(Date.now() - 86400000);
    return { start: normalizeToISTBoundary(yesterday, 'start'), end: normalizeToISTBoundary(yesterday, 'end') };
  }},
  { label: 'Last 7 Days', value: 'last7days', getDates: () => {
    const start = normalizeToISTBoundary(new Date(Date.now() - 6 * 86400000), 'start');
    const end = normalizeToISTBoundary(new Date(), 'end');
    return { start, end };
  }},
  { label: 'Last 30 Days', value: 'last30days', getDates: () => {
    const start = normalizeToISTBoundary(new Date(Date.now() - 29 * 86400000), 'start');
    const end = normalizeToISTBoundary(new Date(), 'end');
    return { start, end };
  }},
];

export const SmartFilters: React.FC<SmartFiltersProps> = ({ cameras, filters, onFiltersChange }) => {
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Record<string, { count: number; motion: number; face: number; persons: number; avgConfidence: number }>>({});
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    const count = [filters.cameraId !== 'all', filters.detectionType !== 'all', filters.quickRange !== 'all', filters.dateRange.start !== undefined].filter(Boolean).length;
    setActiveFilterCount(count);
  }, [filters]);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const newFilters = { ...filters, [key]: value };
    if (key === 'quickRange' && value !== 'all') {
      const option = quickRangeOptions.find(o => o.value === value);
      if (option) { const dates = option.getDates(); newFilters.dateRange = { start: dates.start, end: dates.end }; }
    } else if (key === 'quickRange' && value === 'all') {
      newFilters.dateRange = { start: undefined, end: undefined };
    }
    onFiltersChange?.(newFilters);
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    const cleared: FilterState = { cameraId: 'all', detectionType: 'all', dateRange: { start: undefined, end: undefined }, quickRange: 'all' };
    onFiltersChange?.(cleared);
  }, [onFiltersChange]);

  const fetchCalendarData = useCallback(async () => {
    setLoadingCalendar(true);
    try {
      const result = await eventService.getCalendarStats(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, filters.cameraId === 'all' ? undefined : filters.cameraId);
      setCalendarData(result.data);
    } catch (error) { console.error('Error fetching calendar data:', error); }
    finally { setLoadingCalendar(false); }
  }, [calendarMonth, filters.cameraId]);

  useEffect(() => { if (showCalendar) fetchCalendarData(); }, [showCalendar, fetchCalendarData]);

  const getDayClasses = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayData = calendarData[dateKey];
    const isCurrentMonth = isSameMonth(day, calendarMonth);
    const isSelected = filters.dateRange.start && isSameDay(day, filters.dateRange.start);
    if (!isCurrentMonth) return 'opacity-30';
    if (dayData && dayData.count > 0) {
      if (isSelected) return 'bg-primary';
      if (isToday(day)) return 'bg-amber-500 text-white';
      return 'bg-primary/20';
    }
    if (isSelected) return 'bg-primary';
    if (isToday(day)) return 'bg-amber-500 text-white';
    return 'hover:bg-white/[0.06]';
  };

  const calendarDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(calendarMonth)), end: endOfWeek(endOfMonth(calendarMonth)) });

  const handleCalendarDayClick = (day: Date) => {
    if (!isSameMonth(day, calendarMonth)) setCalendarMonth(day);
    const normalizedStart = normalizeToISTBoundary(day, 'start');
    const normalizedEnd = normalizeToISTBoundary(day, 'end');
    if (filters.dateRange.start && !filters.dateRange.end) {
      const start = filters.dateRange.start > normalizedStart ? normalizedStart : filters.dateRange.start;
      const end = filters.dateRange.start > normalizedStart ? filters.dateRange.start : normalizedEnd;
      const newFilters = { ...filters, dateRange: { start, end }, quickRange: 'all' as const };
      onFiltersChange?.(newFilters);
    } else {
      const newFilters = { ...filters, dateRange: { start: normalizedStart, end: normalizedEnd }, quickRange: 'all' as const };
      onFiltersChange?.(newFilters);
    }
    setShowCalendar(false);
  };

  return (
    <div className="w-full px-5 py-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 flex-wrap">
          <Select value={filters.quickRange} onValueChange={(value) => updateFilter('quickRange', value as FilterState['quickRange'])}>
            <SelectTrigger className="w-full md:w-36 h-9 rounded-[0.75rem] bg-white/[0.06] border-white/[0.14] text-xs">
              <Calendar className="h-3.5 w-3.5 mr-2" />
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 backdrop-blur-3xl border-white/[0.14] rounded-[1.25rem]">
              {quickRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="rounded-[0.75rem] text-xs">{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.cameraId} onValueChange={(value) => updateFilter('cameraId', value)}>
            <SelectTrigger className="w-full md:w-36 h-9 rounded-[0.75rem] bg-white/[0.06] border-white/[0.14] text-xs">
              <Camera className="h-3.5 w-3.5 mr-2" />
              <SelectValue placeholder="All Cameras" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 backdrop-blur-3xl border-white/[0.14] rounded-[1.25rem]">
              <SelectItem value="all" className="rounded-[0.75rem] text-xs">All Cameras</SelectItem>
              {cameras.map((camera) => (
                <SelectItem key={camera.id} value={camera.id} className="rounded-[0.75rem] text-xs">{camera.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.detectionType} onValueChange={(value: string) => updateFilter('detectionType', value as FilterState['detectionType'])}>
            <SelectTrigger className="w-full md:w-32 h-9 rounded-[0.75rem] bg-white/[0.06] border-white/[0.14] text-xs">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 backdrop-blur-3xl border-white/[0.14] rounded-[1.25rem]">
              <SelectItem value="all" className="rounded-[0.75rem] text-xs">All Events</SelectItem>
              <SelectItem value="motion" className="rounded-[0.75rem] text-xs">Motion</SelectItem>
              <SelectItem value="person" className="rounded-[0.75rem] text-xs">Person</SelectItem>
              <SelectItem value="face" className="rounded-[0.75rem] text-xs">Face</SelectItem>
              <SelectItem value="vehicle" className="rounded-[0.75rem] text-xs">Vehicle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={cn('h-9 text-xs', filters.dateRange.start ? '' : 'text-muted-foreground')}>
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                {filters.dateRange.start ? (
                  <span>{format(filters.dateRange.start, 'MMM d')}{filters.dateRange.end ? ` - ${format(filters.dateRange.end, 'MMM d')}` : ''}</span>
                ) : <span>Calendar</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-[1.25rem] bg-black/90 backdrop-blur-3xl border-white/[0.14]" align="end">
              <div className="p-3 hairline-bottom flex items-center justify-between">
                <Button variant="ghost" size="icon-sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-medium">{format(calendarMonth, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 p-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[10px] text-muted-foreground py-1">{day}</div>
                ))}
                {calendarDays.map((day, i) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayData = calendarData[dateKey];
                  return (
                    <button key={i} onClick={() => handleCalendarDayClick(day)}
                      className={cn('relative h-8 w-8 rounded-full text-xs transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]', getDayClasses(day), !isSameMonth(day, calendarMonth) && 'opacity-30')}
                      disabled={!isSameMonth(day, calendarMonth)}
                    >
                      {format(day, 'd')}
                      {dayData && dayData.count > 0 && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground">{dayData.count}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="p-2 hairline-top flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-primary/20" /><span>Events</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span>Today</span></div>
              </div>
            </PopoverContent>
          </Popover>

          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" className="h-9 text-xs text-muted-foreground" onClick={clearAllFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {filters.quickRange !== 'all' && (
            <Badge variant="default" className="cursor-pointer text-[10px]" onClick={() => updateFilter('quickRange', 'all')}>
              {quickRangeOptions.find(o => o.value === filters.quickRange)?.label}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          )}
          {filters.cameraId !== 'all' && (
            <Badge variant="default" className="cursor-pointer text-[10px]" onClick={() => updateFilter('cameraId', 'all')}>
              <Camera className="h-2.5 w-2.5 mr-1" />{cameras.find(c => c.id === filters.cameraId)?.name || filters.cameraId}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          )}
          {filters.detectionType !== 'all' && (
            <Badge variant="default" className="cursor-pointer text-[10px]" onClick={() => updateFilter('detectionType', 'all')}>
              {filters.detectionType}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          )}
          {filters.dateRange.start && (
            <Badge variant="default" className="cursor-pointer text-[10px]" onClick={() => { const cleared = { ...filters, dateRange: { start: undefined, end: undefined }, quickRange: 'all' as const }; onFiltersChange?.(cleared); }}>
              <Calendar className="h-2.5 w-2.5 mr-1" />{format(filters.dateRange.start, 'MMM d')}{filters.dateRange.end ? ` - ${format(filters.dateRange.end, 'MMM d')}` : ''}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
