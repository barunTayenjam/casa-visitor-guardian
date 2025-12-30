import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  UserCheck, 
  Calendar, 
  Clock, 
  Image as ImageIcon,
  Filter,
  Grid3X3,
  List,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Video
} from 'lucide-react';
import { format } from 'date-fns';
import apiService from '@/services/ApiService';

interface MotionEvent {
  filename: string;
  timestamp: Date;
  cameraId: string;
  timestampStr: string;
}

interface BatchResult {
  filename: string;
  persons: number;
  faces: number;
  knownFaces: number;
  unknownFaces: number;
}

interface DetectionGalleryProps {
  className?: string;
}

const DetectionGallery: React.FC<DetectionGalleryProps> = ({ className }) => {
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MotionEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<MotionEvent | null>(null);
  const [batchResults, setBatchResults] = useState<Map<string, BatchResult>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | 'all'>('24h');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const [detectionData, setDetectionData] = useState<any>(null);
  
  const timeRangeLabels = {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    'all': 'All Time'
  };

  useEffect(() => {
    loadEvents();
    loadBatchResults();
    
    const interval = setInterval(() => {
      loadEvents();
      loadBatchResults();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, timeRange, cameraFilter]);

  const loadEvents = async () => {
    try {
      const files = await apiService.getEventsList();
      
      const parsedEvents: MotionEvent[] = files.map((filename: string) => {
        const parts = filename.split('_');
        const cameraId = parts[1] || 'unknown';
        let timestamp = new Date();
        
        if (parts.length >= 3) {
          const timestampPart = parts[2]?.replace('.jpg', '');
          if (timestampPart) {
            const cleanTimestampPart = timestampPart.replace(/Z$/, '');
            const numericTimestamp = parseInt(cleanTimestampPart, 10);
            const isNumeric = !isNaN(numericTimestamp) && /^\d+$/.test(cleanTimestampPart) && cleanTimestampPart.length > 4;
            if (isNumeric) {
              timestamp = new Date(numericTimestamp);
            } else if (timestampPart.includes('T')) {
              const datePart = timestampPart.substring(0, 10);
              const timePart = timestampPart.substring(11);
              const isoTimestamp = `${datePart}T${timePart.replace(/-/g, ':').replace(/:([0-9]{3})Z$/, '.$1Z')}`;
              timestamp = new Date(isoTimestamp);
            }
          }
        }
        
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
        
        return {
          filename,
          timestamp,
          cameraId,
          timestampStr: timestamp.toISOString()
        };
      }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setEvents(parsedEvents);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load events:', error);
      setIsLoading(false);
    }
  };

  const loadBatchResults = async () => {
    try {
      const jobs = await apiService.getBatchJobs();
      const resultsMap = new Map<string, BatchResult>();
      
      for (const job of jobs) {
        if (job.status === 'completed' && job.results) {
          const detailResults = await apiService.getBatchResults(job.id);
          if (detailResults && detailResults.results) {
            for (const result of detailResults.results) {
              const filename = result.filename || result.timestamp?.split('/').pop();
              resultsMap.set(filename, {
                filename,
                persons: result.persons?.length || 0,
                faces: result.faces?.length || 0,
                knownFaces: result.faces?.filter((f: any) => f.isKnown).length || 0,
                unknownFaces: result.faces?.filter((f: any) => !f.isKnown).length || 0
              });
            }
          }
        }
      }
      
      setBatchResults(resultsMap);
    } catch (error) {
      console.error('Failed to load batch results:', error);
    }
  };

  const filterEvents = () => {
    const now = new Date();
    let filtered = [...events];
    
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      'all': Infinity
    };
    
    const timeLimit = timeRanges[timeRange];
    if (timeLimit !== Infinity) {
      const cutoff = new Date(now.getTime() - timeLimit);
      filtered = filtered.filter(e => e.timestamp >= cutoff);
    }
    
    if (cameraFilter !== 'all') {
      filtered = filtered.filter(e => e.cameraId === cameraFilter);
    }
    
    setFilteredEvents(filtered);
  };

  const getUniqueCameras = () => {
    const cameras = new Set(events.map(e => e.cameraId));
    return Array.from(cameras).sort();
  };

  const handleImageClick = (event: MotionEvent, index: number) => {
    setSelectedEvent(event);
    setSelectedIndex(filteredEvents.indexOf(event));
    setIsImageDialogOpen(true);
    
    const result = batchResults.get(event.filename);
    setDetectionData(result || null);
  };

  const handleDownloadImage = async (event: MotionEvent) => {
    try {
      const response = await fetch(`http://192.168.31.99:5173/events/${event.filename}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = event.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const renderBoundingBoxes = () => {
    if (!detectionData || !imageRef.current) return null;
    if (detectionData.persons === 0 && detectionData.faces === 0) return null;
    
    const img = imageRef.current;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    
    return (
      <svg 
        className="absolute inset-0 pointer-events-none"
        style={{ width: img.clientWidth, height: img.clientHeight }}
      >
        <text x="10" y="20" fill="white" fontSize="12" fontWeight="bold">
          {detectionData.persons} Person(s) • {detectionData.faces} Face(s)
        </text>
      </svg>
    );
  };

  const stats = {
    total: filteredEvents.length,
    withPersons: filteredEvents.filter(e => batchResults.get(e.filename)?.persons! > 0).length,
    withFaces: filteredEvents.filter(e => batchResults.get(e.filename)?.faces! > 0).length,
    cameras: new Set(filteredEvents.map(e => e.cameraId)).size
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <ImageIcon className="h-4 w-4 inline mr-2" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 inline mr-2" />
              With Persons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.withPersons}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <UserCheck className="h-4 w-4 inline mr-2" />
              With Faces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withFaces}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Video className="h-4 w-4 inline mr-2" />
              Cameras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cameras}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last Hour</SelectItem>
                    <SelectItem value="6h">Last 6 Hours</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={cameraFilter} onValueChange={setCameraFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Cameras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cameras</SelectItem>
                    {getUniqueCameras().map(camera => (
                      <SelectItem key={camera} value={camera}>{camera}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Showing {filteredEvents.length} of {events.length} events
              </div>
            </div>
            
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Events Grid/List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              <Calendar className="h-5 w-5 inline mr-2" />
              Detection Events
            </span>
            <Badge variant="outline">
              {timeRangeLabels[timeRange]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="mx-auto h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No events found</p>
              <p className="text-sm mt-2">Try adjusting time range or camera filter, or run batch processing to analyze images</p>
            </div>
          ) : viewMode === 'grid' ? (
            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredEvents.map((event, index) => {
                  const detection = batchResults.get(event.filename);
                  return (
                    <div
                      key={event.filename}
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => handleImageClick(event, index)}
                    >
                      <div className="aspect-video bg-muted relative">
                        <img
                          src={`http://192.168.31.99:5173/events/${event.filename}`}
                          alt={event.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        
                        {/* Detection badges */}
                        {detection && (detection.persons > 0 || detection.faces > 0) && (
                          <div className="absolute top-2 left-2 flex gap-1">
                            {detection.persons > 0 && (
                              <Badge className="bg-green-500 text-white">
                                <Users className="h-3 w-3 mr-1" />
                                {detection.persons}
                              </Badge>
                            )}
                            {detection.faces > 0 && (
                              <Badge className="bg-blue-500 text-white">
                                <UserCheck className="h-3 w-3 mr-1" />
                                {detection.faces}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <div className="text-sm font-medium truncate" title={event.filename}>
                          {event.filename}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <Video className="h-3 w-3 mr-1" />
                            {event.cameraId}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(event.timestamp, 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        {detection && (
                          <div className="flex gap-2 mt-1 text-xs">
                            {detection.persons > 0 && (
                              <span className="text-green-600">
                                {detection.persons} person(s)
                              </span>
                            )}
                            {detection.faces > 0 && (
                              <span className="text-blue-600">
                                {detection.knownFaces} known, {detection.unknownFaces} unknown
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredEvents.map((event, index) => {
                  const detection = batchResults.get(event.filename);
                  return (
                    <div
                      key={event.filename}
                      className="flex items-center gap-4 p-3 border rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleImageClick(event, index)}
                    >
                      <div className="w-32 h-20 bg-muted rounded relative overflow-hidden flex-shrink-0">
                        <img
                          src={`http://192.168.31.99:5173/events/${event.filename}`}
                          alt={event.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium truncate" title={event.filename}>
                            {event.filename}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {detection && detection.persons > 0 && (
                              <Badge className="bg-green-500 text-white text-xs">
                                {detection.persons}P
                              </Badge>
                            )}
                            {detection && detection.faces > 0 && (
                              <Badge className="bg-blue-500 text-white text-xs">
                                {detection.faces}F
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{event.cameraId}</span>
                          <span>•</span>
                          <span>{format(event.timestamp, 'MMM dd, yyyy HH:mm:ss')}</span>
                        </div>
                        
                        {detection && (
                          <div className="flex gap-3 mt-1 text-xs">
                            <span className="text-green-600">
                              {detection.persons} person(s)
                            </span>
                            <span className="text-blue-600">
                              {detection.knownFaces} known, {detection.unknownFaces} unknown
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Image Detail Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate max-w-[400px]" title={selectedEvent?.filename}>
                {selectedEvent?.filename}
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedEvent && handleDownloadImage(selectedEvent)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                  disabled={selectedIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIndex(Math.min(filteredEvents.length - 1, selectedIndex + 1))}
                  disabled={selectedIndex === filteredEvents.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  ref={imageRef}
                  src={`http://192.168.31.99:5173/events/${selectedEvent.filename}`}
                  alt={selectedEvent.filename}
                  className="max-w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {renderBoundingBoxes()}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium mb-2">Event Details</div>
                  <div className="space-y-1 text-muted-foreground">
                    <div>Filename: {selectedEvent.filename}</div>
                    <div>Camera: {selectedEvent.cameraId}</div>
                    <div>Time: {format(selectedEvent.timestamp, 'PPpp')}</div>
                  </div>
                </div>
                
                <div>
                  <div className="font-medium mb-2">Detections</div>
                  {detectionData ? (
                    <div className="space-y-2">
                      {detectionData.persons > 0 && (
                        <div>
                          <div className="text-green-600 font-medium">
                            {detectionData.persons} Person(s) detected
                          </div>
                        </div>
                      )}
                      {detectionData.faces > 0 && (
                        <div>
                          <div className="text-blue-600 font-medium">
                            {detectionData.faces} Face(s) detected
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {detectionData.knownFaces} known, {detectionData.unknownFaces} unknown
                          </div>
                        </div>
                      )}
                      {detectionData.persons === 0 && detectionData.faces === 0 && (
                        <div className="text-muted-foreground">
                          No detection data available. Run batch processing to analyze this image.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      No detection data available. Run batch processing to analyze this image.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetectionGallery;
