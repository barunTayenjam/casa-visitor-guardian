import { useEvents } from '@/contexts/EventsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const EventsDataDebug = () => {
  const { events, loading, error, hasMore } = useEvents();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Events Data Debug
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div><strong>Total Events:</strong> {events.length}</div>
          <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
          <div><strong>Error:</strong> {error || 'None'}</div>
          <div><strong>Has More:</strong> {hasMore ? 'Yes' : 'No'}</div>
          
          {showDetails && (
            <div className="mt-4 space-y-3">
              <h4 className="font-semibold">Event Details:</h4>
              {events.length === 0 ? (
                <div className="text-red-600">No events found!</div>
              ) : (
                events.map((event, index) => (
                  <div key={event.id} className="border p-3 rounded bg-gray-50">
                    <div><strong>#{index + 1} ID:</strong> {event.id}</div>
                    <div><strong>Camera:</strong> {event.cameraName} ({event.cameraId})</div>
                    <div><strong>Time:</strong> {event.timestamp.toLocaleString()}</div>
                    <div><strong>Confidence:</strong> {Math.round(event.confidence * 100)}%</div>
                    <div><strong>Labels:</strong> {event.labels.join(', ')}</div>
                    <div><strong>Location:</strong> {event.location}</div>
                    <div><strong>Image URL:</strong> {event.imageUrl || 'None'}</div>
                    <div><strong>Duration:</strong> {event.duration}ms</div>
                    <div><strong>Archived:</strong> {event.archived ? 'Yes' : 'No'}</div>
                  </div>
                ))
              )}
            </div>
          )}
          
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <h4 className="font-semibold text-blue-800">Expected Mock Data:</h4>
            <div className="text-blue-700 text-xs mt-1">
              Should have 5 events: Front Door (10min ago), Back Yard (30min ago), 
              Front Door (2h ago), Side Gate (4h ago), Back Yard (1 day ago)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};