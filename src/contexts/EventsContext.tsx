import React, { createContext, useContext, useEffect, useState } from 'react';
import { MotionEvent, Camera } from '@/types/security'; // Ensure Camera is imported if not already
import { useSocketContext } from './SocketContext';
import { useCameras } from './CameraContext';

interface EventsContextType {
  events: MotionEvent[];
  loading: boolean;
  error: string | null;
  clearEvents: () => void;
  archiveEvent: (eventId: string) => void;
  loadMoreEvents: () => void;
  hasMore: boolean;
}

interface MotionEventData {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  labels?: string[];
}

interface MotionSnapshotData {
  eventId: string;
  snapshotPath: string;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with some mock events for testing
  const mockEvents: MotionEvent[] = [
    {
      id: 'evt1',
      cameraId: 'cam1',
      cameraName: 'Front Door',
      timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      imageUrl: 'https://picsum.photos/400/300?random=1',
      confidence: 0.85,
      labels: ['motion', 'person'],
      location: 'Front Entrance',
      duration: 5000,
      archived: false
    },
    {
      id: 'evt2',
      cameraId: 'cam2',
      cameraName: 'Back Yard',
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      imageUrl: 'https://picsum.photos/400/300?random=2',
      confidence: 0.72,
      labels: ['motion'],
      location: 'Back Garden',
      duration: 3000,
      archived: false
    },
    {
      id: 'evt3',
      cameraId: 'cam1',
      cameraName: 'Front Door',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      imageUrl: 'https://picsum.photos/400/300?random=3',
      confidence: 0.91,
      labels: ['motion', 'person', 'vehicle'],
      location: 'Front Entrance',
      duration: 8000,
      archived: false
    },
    {
      id: 'evt4',
      cameraId: 'cam3',
      cameraName: 'Side Gate',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      imageUrl: 'https://picsum.photos/400/300?random=4',
      confidence: 0.68,
      labels: ['motion'],
      location: 'Side Entrance',
      duration: 2000,
      archived: false
    },
    {
      id: 'evt5',
      cameraId: 'cam2',
      cameraName: 'Back Yard',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      imageUrl: 'https://picsum.photos/400/300?random=5',
      confidence: 0.79,
      labels: ['motion', 'animal'],
      location: 'Back Garden',
      duration: 6000,
      archived: false
    }
  ];

  const [events, setEvents] = useState<MotionEvent[]>(mockEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { socket } = useSocketContext();
  const { cameras } = useCameras(); // Get cameras from CameraContext

  useEffect(() => {
    if (!socket) return;

    // Listen for motion detection events
    socket.on('motionDetected', (eventData: MotionEventData) => {
      // Ensure eventData and eventData.cameraId exist
      if (!eventData || !eventData.cameraId) {
        console.warn('Received motionDetected event with missing data:', eventData);
        return; 
      }
      
      const camera = cameras.find(c => c.id === eventData.cameraId);
      const newEvent: MotionEvent = {
        id: eventData.id || `evt_${Date.now()}`, // Fallback for event ID
        cameraId: eventData.cameraId,
        cameraName: camera ? camera.name : eventData.cameraId || 'Unknown Camera',
        timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(), // Fallback for timestamp
        imageUrl: eventData.imagePath || null, // Fallback for imagePath
        confidence: typeof eventData.confidence === 'number' ? eventData.confidence / 100 : 0, // Convert from 0-100 to 0-1, fallback
        labels: Array.isArray(eventData.labels) && eventData.labels.length > 0 ? eventData.labels : ['motion'],
        location: camera ? camera.location : 'Unknown Location',
        duration: typeof eventData.duration === 'number' ? eventData.duration : 0, // Fallback for duration
        archived: false
      };

      setEvents(prev => [newEvent, ...prev].slice(0, 50)); // Keep last 50 events only
    });

    // Listen for snapshot updates
    socket.on('motionSnapshot', (data: MotionSnapshotData) => {
      if (data.eventId && data.snapshotPath) {
        setEvents(prev => 
          prev.map(event => 
            event.id === data.eventId 
              ? { ...event, imageUrl: data.snapshotPath } 
              : event
          )
        );
      }
    });

    return () => {
      socket.off('motionDetected');
      socket.off('motionSnapshot');
    };
  }, [socket, cameras]); // Add cameras to dependency array

  const clearEvents = () => {
    setEvents([]);
  };

  const archiveEvent = (eventId: string) => {
    setEvents(prev => 
      prev.map(event => 
        event.id === eventId 
          ? { ...event, archived: true } 
          : event
      )
    );
  };

  const loadMoreEvents = () => {
    // Mock implementation - in real app this would load more from API
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setHasMore(false); // No more events to load
    }, 1000);
  };

  return (
    <EventsContext.Provider value={{ 
      events, 
      loading, 
      error, 
      clearEvents, 
      archiveEvent, 
      loadMoreEvents, 
      hasMore 
    }}>
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};
