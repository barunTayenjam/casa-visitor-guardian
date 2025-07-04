import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, Download, Filter, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MotionEvent } from '@/types/security';
import apiService, { ApiError } from '@/services/ApiService';
import { useCameras } from '@/contexts/CameraContext';

const History = () => {
  const { toast } = useToast();
  const { cameras } = useCameras();
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistoricalEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getHistoricalEvents({
        page: currentPage,
        pageSize: 10, // You can make this configurable
        cameraId: selectedCamera === 'all' ? undefined : selectedCamera,
        searchQuery: searchQuery || undefined,
        startDate: selectedDate || undefined,
        endDate: selectedDate ? new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined, // End of selected day
      });
      setEvents(response.events);
      setTotalPages(response.pagination.totalPages);
      setTotalEvents(response.pagination.totalEvents);
    } catch (err) {
      console.error('Failed to fetch historical events:', err);
      toast({
        title: "Error",
        description: `Failed to load historical events: ${err instanceof ApiError ? err.message : String(err)}`,
        variant: "destructive",
      });
      setEvents([]);
      setTotalPages(1);
      setTotalEvents(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedCamera, searchQuery, selectedDate, toast]);

  useEffect(() => {
    fetchHistoricalEvents();
  }, [fetchHistoricalEvents]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const downloadEvent = (event: MotionEvent) => {
    if (!event.imageUrl) {
      toast({
        title: "Download Failed",
        description: "No image available for this event",
        variant: "destructive"
      });
      return;
    }
    
    const link = document.createElement('a');
    link.href = event.imageUrl;
    link.download = `event_${event.cameraName || event.cameraId}_${format(event.timestamp, 'yyyy-MM-dd_HH-mm-ss')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueCameraNames = [...new Set(cameras.map(cam => cam.name))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Event History</h1>
        <p className="text-muted-foreground mt-2">
          View and search through all recorded security events
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cameras</SelectItem>
                  {uniqueCameraNames.map(cameraName => (
                    <SelectItem key={cameraName} value={cameraName}>{cameraName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {(selectedDate || selectedCamera !== 'all' || searchQuery) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedDate(undefined);
                    setSelectedCamera('all');
                    setSearchQuery('');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No events found matching your criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>Labels</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {format(event.timestamp, 'MMM d, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>{event.cameraName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {event.labels?.map((label, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{Math.round(event.confidence * 100)}%</TableCell>
                    <TableCell>{event.duration}s</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadEvent(event)}
                        disabled={!event.imageUrl}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                </PaginationItem>
                {[...Array(totalPages)].map((_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink href="#" isActive={index + 1 === currentPage} onClick={() => handlePageChange(index + 1)}>
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
