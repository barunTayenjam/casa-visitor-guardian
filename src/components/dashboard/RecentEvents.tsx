
import { Calendar, Camera as CameraIcon, MapPin, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MotionEvent } from '@/types/security';
import { useState } from 'react';

export const RecentEvents = () => {
  const [events] = useState<MotionEvent[]>([
    {
      id: '1',
      cameraId: 'cam1',
      cameraName: 'Front Door',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      imageUrl: '/placeholder-event.jpg',
      confidence: 0.89,
      labels: ['person'],
      location: 'Main Entrance',
      duration: 45,
      archived: false
    },
    {
      id: '2',
      cameraId: 'cam4',
      cameraName: 'Driveway',
      timestamp: new Date(Date.now() - 23 * 60 * 1000),
      imageUrl: '/placeholder-event.jpg',
      confidence: 0.92,
      labels: ['vehicle', 'person'],
      location: 'Vehicle Area',
      duration: 120,
      archived: false
    },
    {
      id: '3',
      cameraId: 'cam2',
      cameraName: 'Backyard',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      imageUrl: '/placeholder-event.jpg',
      confidence: 0.76,
      labels: ['animal'],
      location: 'Garden Area',
      duration: 30,
      archived: false
    },
    {
      id: '4',
      cameraId: 'cam1',
      cameraName: 'Front Door',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      imageUrl: '/placeholder-event.jpg',
      confidence: 0.95,
      labels: ['person', 'package'],
      location: 'Main Entrance',
      duration: 180,
      archived: false
    },
    {
      id: '5',
      cameraId: 'cam4',
      cameraName: 'Driveway',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      imageUrl: '/placeholder-event.jpg',
      confidence: 0.83,
      labels: ['vehicle'],
      location: 'Vehicle Area',
      duration: 90,
      archived: false
    }
  ]);

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
    switch (label) {
      case 'person':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'vehicle':
        return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
      case 'animal':
        return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'package':
        return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Motion Events</CardTitle>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            View All
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {events.map((event, index) => (
              <div
                key={event.id}
                className="motion-event flex gap-4 p-3 rounded-lg border border-border hover:bg-muted/50"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-16 h-16 bg-slate-800 rounded-lg flex-shrink-0 flex items-center justify-center">
                  <CameraIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium truncate">{event.cameraName}</h4>
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
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
