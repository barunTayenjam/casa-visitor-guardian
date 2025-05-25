import React, { createContext, useContext, useEffect, useState } from 'react';
import { MotionEvent, Camera } from '@/types/security'; // Ensure Camera is imported if not already
import { useSocketContext } from './SocketContext';
import { useCameras } from './CameraContext';

interface EventsContextType {
  events: MotionEvent[];
  clearEvents: () => void;
  archiveEvent: (eventId: string) => void;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const { socket } = useSocketContext();
  const { cameras } = useCameras(); // Get cameras from CameraContext

  useEffect(() => {
    if (!socket) return;

    // Listen for motion detection events
    socket.on('motionDetected', (eventData: any) => {
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
    socket.on('motionSnapshot', (data: any) => {
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

  return (
    <EventsContext.Provider value={{ events, clearEvents, archiveEvent }}>
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
