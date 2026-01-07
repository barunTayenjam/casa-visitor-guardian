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
  Video,
  User,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import apiService, { EnhancedEvent, DetectionData, FaceDetectionData } from '@/services/ApiService';

interface MotionEvent {
  id?: string;
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
  const [selectedEnhancedEvent, setSelectedEnhancedEvent] = useState<EnhancedEvent | null>(null);
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
      const response = await apiService.getEnhancedEventsList({ limit: 100 });
      
      const parsedEvents: MotionEvent[] = response.events.map((event) => {
        return {
          id: event.id,
          filename: event.filename,
          timestamp: new Date(event.timestamp),
          cameraId: event.cameraId,
          timestampStr: new Date(event.timestamp).toISOString()
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

  const handleImageClick = async (event: MotionEvent, index: number) => {
    setSelectedEvent(event);
    setSelectedIndex(filteredEvents.indexOf(event));
    setIsImageDialogOpen(true);
    
    // Fetch detailed event info
    if (event.id) {
      try {
        const details = await apiService.getEventDetails(event.id);
        if (details.success) {
          setSelectedEnhancedEvent(details.event);
          setDetectionData({
            persons: details.event.persons_detected,
            faces: details.event.faces_detected,
            knownFaces: details.event.known_faces_count,
            unknownFaces: details.event.unknown_faces_count
          });
          return;
        }
      } catch (error) {
        console.error('Failed to fetch event details:', error);
      }
    }

    // Fallback to batch results
    const result = batchResults.get(event.filename);
    setDetectionData(result || null);
    setSelectedEnhancedEvent(null);
  };

  const handleDownloadImage = async (event: MotionEvent) => {
    try {
      const response = await fetch(`/api/events/image/${event.filename}`);
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
    if (detectionData.persons === 0 && detectionData.faces === 0 && !selectedEnhancedEvent?.object_detections?.length) return null;
    
    const img = imageRef.current;
    
    return (
      <svg 
        className="absolute inset-0 pointer-events-none"
        style={{ width: img.clientWidth, height: img.clientHeight }}
      >
        <text x="10" y="20" fill="white" fontSize="12" fontWeight="bold" stroke="black" strokeWidth="0.5">
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
                          src={`/api/events/image/${event.filename}`}
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
                          src={`/api/events/image/${event.filename}`}
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
      <Dialog open={isImageDialogOpen} onOpenChange={(open) => {
        setIsImageDialogOpen(open);
        if (!open) {
          setSelectedEvent(null);
          setSelectedEnhancedEvent(null);
          setDetectionData(null);
        }
      }}>
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
                  onClick={() => {
                    const newIndex = Math.max(0, selectedIndex - 1);
                    handleImageClick(filteredEvents[newIndex], newIndex);
                  }}
                  disabled={selectedIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newIndex = Math.min(filteredEvents.length - 1, selectedIndex + 1);
                    handleImageClick(filteredEvents[newIndex], newIndex);
                  }}
                  disabled={selectedIndex === filteredEvents.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="relative inline-block bg-black/5 rounded-lg overflow-hidden">
                <img
                  ref={imageRef}
                  src={`/api/events/image/${selectedEvent.filename}`}
                  alt={selectedEvent.filename}
                  className="max-w-full h-auto max-h-[60vh] object-contain mx-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {renderBoundingBoxes()}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Event Details</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Filename</span>
                      <span className="font-mono text-xs">{selectedEvent.filename}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Camera</span>
                      <span>{selectedEvent.cameraId}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Time</span>
                      <span>{format(selectedEvent.timestamp, 'PPP p')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID</span>
                      <span className="font-mono text-xs">{selectedEvent.id || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Detections</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    {selectedEnhancedEvent ? (
                      <div className="space-y-4">
                        {/* Person Detections */}
                        {selectedEnhancedEvent.persons_detected > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {selectedEnhancedEvent.persons_detected} Person(s)
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Face Detections */}
                        {selectedEnhancedEvent.faces_detected > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {selectedEnhancedEvent.faces_detected} Face(s)
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedEnhancedEvent.face_detections?.map((face, i) => (
                                <Badge 
                                  key={i} 
                                  className={face.isKnown ? "bg-green-500 hover:bg-green-600" : "bg-yellow-500 hover:bg-yellow-600"}
                                >
                                  {face.isKnown ? face.name : "Unknown"} ({Math.round(face.confidence)}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Object Detections */}
                        {selectedEnhancedEvent.object_detections && selectedEnhancedEvent.object_detections.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {selectedEnhancedEvent.object_detections.length} Object(s)
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedEnhancedEvent.object_detections.map((obj, i) => (
                                <Badge key={i} className="bg-blue-500 hover:bg-blue-600">
                                  {obj.class} ({Math.round(obj.confidence)}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedEnhancedEvent.persons_detected === 0 && 
                         selectedEnhancedEvent.faces_detected === 0 && 
                         (!selectedEnhancedEvent.object_detections || selectedEnhancedEvent.object_detections.length === 0) && (
                          <div className="text-muted-foreground text-center py-2">
                            No objects or faces detected in this event.
                          </div>
                        )}
                      </div>
                    ) : detectionData ? (
                      <div className="space-y-2">
                        {detectionData.persons > 0 && (
                          <div className="text-green-600 font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {detectionData.persons} Person(s) detected
                          </div>
                        )}
                        {detectionData.faces > 0 && (
                          <div>
                            <div className="text-blue-600 font-medium flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              {detectionData.faces} Face(s) detected
                            </div>
                            <div className="text-muted-foreground text-xs mt-1 ml-6">
                              {detectionData.knownFaces} known, {detectionData.unknownFaces} unknown
                            </div>
                          </div>
                        )}
                        {detectionData.persons === 0 && detectionData.faces === 0 && (
                          <div className="text-muted-foreground text-center py-2">
                            No detection summary available.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-center py-4">
                        <p>No detection data available.</p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => {
                            // Close dialog and switch to batch tab
                            setIsImageDialogOpen(false);
                            // This would ideally require lifting state up or using context/router
                            // For now we just show the message
                          }}
                        >
                          Run batch processing to analyze
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetectionGallery;
