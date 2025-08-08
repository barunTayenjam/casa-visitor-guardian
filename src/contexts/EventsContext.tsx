import React, { createContext, useContext, useEffect, useState } from 'react';
import { DetectionEvent } from '@/types/security';
import { useSocketContext } from './SocketContext';

interface EventsContextType {
  events: DetectionEvent[];
  clearEvents: () => void;
  archiveEvent: (eventId: string) => void;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;

    const handleDetectionEvent = (eventData: any) => {
      const newEvent: DetectionEvent = {
        id: eventData.id,
        cameraId: eventData.cameraId,
        cameraName: 'Front Door', // This should probably be dynamic
        timestamp: new Date(eventData.timestamp),
        imageUrl: eventData.imagePath,
        confidence: eventData.confidence / 100,
        labels: [eventData.type],
        location: 'Front Door',
        duration: eventData.duration || 0,
        archived: false,
        type: eventData.type,
        boundingBoxes: eventData.boundingBoxes
      };

      setEvents(prev => [newEvent, ...prev].slice(0, 50)); // Keep last 50 events only
    };

    // Listen for motion and person detection events
    socket.on('motionDetected', handleDetectionEvent);
    socket.on('personDetected', handleDetectionEvent);

    // Listen for snapshot updates
    socket.on('eventSnapshot', (data: any) => {
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
      socket.off('motionDetected', handleDetectionEvent);
      socket.off('personDetected', handleDetectionEvent);
      socket.off('eventSnapshot');
    };
  }, [socket]);

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
