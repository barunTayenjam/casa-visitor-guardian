import { useState } from 'react';
import { Calendar as CalendarIcon, Download, Filter, Search } from 'lucide-react';
import { useEvents } from '@/contexts/EventsContext';
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MotionEvent } from '@/types/security';

const History = () => {
  const { events } = useEvents();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedCamera, setSelectedCamera] = useState<string>('all');

  // Get unique camera names from events
  const cameras = [...new Set(events.map(event => event.cameraName))];

  // Filter events based on search, date, and camera
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.cameraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.labels.some(label => label.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesDate = !selectedDate || 
                       event.timestamp.toDateString() === selectedDate.toDateString();
    
    const matchesCamera = selectedCamera === 'all' || event.cameraName === selectedCamera;

    return matchesSearch && matchesDate && matchesCamera;
  });

  // Sort events by timestamp (newest first)
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

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
    link.download = `event_${event.cameraName}_${format(event.timestamp, 'yyyy-MM-dd_HH-mm-ss')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
                  {cameras.map(camera => (
                    <SelectItem key={camera} value={camera}>{camera}</SelectItem>
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
              {sortedEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">
                    {format(event.timestamp, 'MMM d, yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell>{event.cameraName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {event.labels.map((label, i) => (
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
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
