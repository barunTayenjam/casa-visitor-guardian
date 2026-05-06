import React, { useState } from 'react';
import { Search, Calendar, Camera, Filter, X } from 'lucide-react';
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
import { colors, spacing } from '@/styles/design-tokens';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
}

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
  });

  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    const count = [
      newFilters.searchQuery,
      newFilters.cameraId !== 'all',
      newFilters.detectionType !== 'all',
      newFilters.dateRange.start || newFilters.dateRange.end,
      newFilters.confidence !== 'all',
    ].filter(Boolean).length;
    
    setActiveFilterCount(count);
    onFiltersChange?.(newFilters);
  };

  const clearAllFilters = () => {
    const clearedFilters: FilterState = {
      searchQuery: '',
      cameraId: 'all',
      detectionType: 'all',
      dateRange: { start: undefined, end: undefined },
      confidence: 'all',
    };
    setFilters(clearedFilters);
    setActiveFilterCount(0);
    onFiltersChange?.(clearedFilters);
  };

  const [showFilters, setShowFilters] = useState(false);

  return (
    <div
      className="w-full p-3 md:p-4 border-b"
      style={{
        backgroundColor: colors.background.secondary,
        borderColor: colors.border.subtle,
      }}
    >
      {/* Mobile: Search + filter toggle row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
            className="pl-10 h-11 min-h-[44px] bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10 text-sm"
          />
        </div>
        
        {/* Mobile filter toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="h-11 w-11 flex-shrink-0 bg-white/5 border-white/10 text-white md:hidden"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter row - expandable on mobile */}
      <div className={cn(
        "mt-3 flex flex-col gap-3 md:flex-row md:items-center md:gap-3",
        showFilters ? "flex" : "hidden md:flex"
      )}>
        {/* Search and Filters */}
        <div className="flex items-center gap-3 flex-1">
          {/* Search Input - hidden on mobile since in separate row */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search events..."
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              className="pl-10 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10"
            />
          </div>

          {/* Camera Filter */}
          <Select
            value={filters.cameraId}
            onValueChange={(value) => updateFilter('cameraId', value)}
          >
            <SelectTrigger className="w-full md:w-40 h-11 min-h-[44px] bg-white/5 border-white/10 text-white text-sm">
              <Camera className="h-4 w-4 mr-2 text-white/60" />
              <SelectValue placeholder="All Cameras" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Cameras</SelectItem>
              {cameras.map((camera) => (
                <SelectItem key={camera} value={camera}>
                  {camera}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Detection Type Filter */}
          <Select
            value={filters.detectionType}
            onValueChange={(value: string) => updateFilter('detectionType', value as FilterState['detectionType'])}
          >
            <SelectTrigger className="w-full md:w-36 h-11 min-h-[44px] bg-white/5 border-white/10 text-white text-sm">
              <Filter className="h-4 w-4 mr-2 text-white/60" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="motion">Motion Only</SelectItem>
              <SelectItem value="person">Person</SelectItem>
              <SelectItem value="face">Face</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full md:w-40 h-11 min-h-[44px] justify-start text-left font-normal text-sm',
                  'bg-white/5 border-white/10 text-white hover:bg-white/10',
                  !filters.dateRange.start && 'text-white/60'
                )}
              >
                <Calendar className="h-4 w-4 mr-2 text-white/60" />
                {filters.dateRange.start ? (
                  format(filters.dateRange.start, 'PPP')
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-slate-900 border-white/10" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.dateRange.start}
                onSelect={(date) =>
                  updateFilter('dateRange', { ...filters.dateRange, start: date })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Confidence Filter */}
          <Select
            value={filters.confidence}
            onValueChange={(value: string) => updateFilter('confidence', value as FilterState['confidence'])}
          >
            <SelectTrigger className="w-full md:w-32 h-11 min-h-[44px] bg-white/5 border-white/10 text-white text-sm">
              <SelectValue placeholder="All Confidence" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="high">High (80%+)</SelectItem>
              <SelectItem value="medium">Medium (50-80%)</SelectItem>
              <SelectItem value="low">Low (&lt;50%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Right: Active Filters Badge & Clear */}
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-blue-500/20 text-blue-400 border-blue-500/30"
            >
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </Badge>
          )}

          {activeFilterCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 text-white/80 hover:text-white hover:bg-white/5"
              onClick={clearAllFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {filters.searchQuery && (
            <Badge
              variant="secondary"
              className="bg-white/5 text-white/80 border-white/10 cursor-pointer hover:bg-white/10"
              onClick={() => updateFilter('searchQuery', '')}
            >
              Search: "{filters.searchQuery}"
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.cameraId !== 'all' && (
            <Badge
              variant="secondary"
              className="bg-white/5 text-white/80 border-white/10 cursor-pointer hover:bg-white/10"
              onClick={() => updateFilter('cameraId', 'all')}
            >
              {filters.cameraId}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.detectionType !== 'all' && (
            <Badge
              variant="secondary"
              className="bg-white/5 text-white/80 border-white/10 cursor-pointer hover:bg-white/10"
              onClick={() => updateFilter('detectionType', 'all')}
            >
              {filters.detectionType}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.dateRange.start && (
            <Badge
              variant="secondary"
              className="bg-white/5 text-white/80 border-white/10 cursor-pointer hover:bg-white/10"
              onClick={() =>
                updateFilter('dateRange', { start: undefined, end: undefined })
              }
            >
              {format(filters.dateRange.start, 'PPP')}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {filters.confidence !== 'all' && (
            <Badge
              variant="secondary"
              className="bg-white/5 text-white/80 border-white/10 cursor-pointer hover:bg-white/10"
              onClick={() => updateFilter('confidence', 'all')}
            >
              {filters.confidence} confidence
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
