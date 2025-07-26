import React, { createContext, useContext, useEffect, useState } from 'react';
import { MotionEvent, Camera } from '@/types/security'; // Ensure Camera is imported if not already
import { useSocketContext } from './SocketContext';
import { useCameras } from './CameraContext';
import apiService from '@/services/ApiService';

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
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { socket } = useSocketContext();
  const { cameras } = useCameras(); // Get cameras from CameraContext

  // Load real events from API
  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getHistoricalEvents({
        page: 1,
        pageSize: 50
      });
      setEvents(response.events);
      setHasMore(response.pagination.currentPage < response.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load events:', err);
      setError('Failed to load motion events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, []);

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

  const loadMoreEvents = async () => {
    // Load real events from API
    setLoading(true);
    try {
      // This would normally load more events from the API
      // For now, we'll just set hasMore to false
      setHasMore(false);
    } catch (error) {
      console.error('Error loading more events:', error);
      setError('Failed to load more events');
    } finally {
      setLoading(false);
    }
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
