import { Calendar, Camera as CameraIcon, MapPin, Clock, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MotionEvent } from '@/types/security';
import { useEvents } from '@/contexts/EventsContext';
import React, { useState, useEffect } from 'react';
import apiService from '@/services/ApiService';

export const RecentEvents = () => {
  const { events, archiveEvent, clearEvents } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [historicalEvents, setHistoricalEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Load historical events to supplement socket events
  useEffect(() => {
    const loadHistoricalEvents = async () => {
      try {
        setLoading(true);
        const apiEvents = await apiService.getMotionEvents(50);
        
        // Convert API events to MotionEvent format
        const convertedEvents: MotionEvent[] = apiEvents.map(event => ({
          id: event.id,
          cameraId: event.cameraId,
          cameraName: event.cameraName || event.cameraId,
          timestamp: new Date(event.timestamp),
          imageUrl: event.imageUrl || null,
          confidence: event.confidence || 0,
          labels: event.labels || ['motion'],
          location: event.location || 'Unknown',
          duration: event.duration || 0,
          archived: false
        }));
        
        setHistoricalEvents(convertedEvents);
      } catch (error) {
        console.error('Failed to load historical events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistoricalEvents();
    
    // Refresh every 2 minutes
    const interval = setInterval(loadHistoricalEvents, 120000);
    return () => clearInterval(interval);
  }, []);

  // Combine socket events with historical events, removing duplicates
  const allEvents = React.useMemo(() => {
    const eventMap = new Map<string, MotionEvent>();
    
    // Add socket events first (they're more recent)
    events.forEach(event => {
      eventMap.set(event.id, event);
    });
    
    // Add historical events if not already present
    historicalEvents.forEach(event => {
      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, event);
      }
    });
    
    // Convert back to array and sort by timestamp
    return Array.from(eventMap.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [events, historicalEvents]);
  
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getLabelColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'person':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'vehicle':
        return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
      case 'animal':
        return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'package':
        return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      case 'motion':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all events?')) {
      clearEvents();
    }
  };

  const nonArchivedEvents = allEvents.filter(event => !event.archived);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Motion Events</CardTitle>
          <div className="flex gap-2">
            {nonArchivedEvents.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              View All
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-96">
          {nonArchivedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <h3 className="text-lg font-medium">No motion events</h3>
              <p className="text-sm">Motion events will appear here when detected by your cameras.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {nonArchivedEvents.map((event, index) => (
                <div
                  key={event.id}
                  className="motion-event flex gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
                >
                  <div className="w-20 h-20 bg-slate-800 rounded-lg flex-shrink-0 overflow-hidden relative">
                    {event.imageUrl ? (
                      <img 
                        src={event.imageUrl} 
                        alt={`Event from ${event.cameraName}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-event.jpg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CameraIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-xs text-white text-center truncate">
                      {event.cameraName}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium truncate">
                        Motion Detected
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(event.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{event.location}</span>
                      <Clock className="h-3 w-3 text-muted-foreground ml-2" />
                      <span className="text-xs text-muted-foreground">{event.duration}s</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {event.labels.map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className={`text-xs ${getLabelColor(label)}`}
                        >
                          {label}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="text-xs">
                        {Math.round(event.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    
                    {selectedEvent === event.id && (
                      <div className="mt-2 flex justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveEvent(event.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Archive
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
