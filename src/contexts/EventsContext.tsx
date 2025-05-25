import React, { createContext, useContext, useEffect, useState } from 'react';
import { MotionEvent } from '@/types/security';
import { useSocketContext } from './SocketContext';

interface EventsContextType {
  events: MotionEvent[];
  clearEvents: () => void;
  archiveEvent: (eventId: string) => void;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;

    // Listen for motion detection events
    socket.on('motionDetected', (eventData: any) => {
      const newEvent: MotionEvent = {
        id: eventData.id,
        cameraId: eventData.cameraId,
        cameraName: 'Front Door',
        timestamp: new Date(eventData.timestamp),
        imageUrl: eventData.imagePath,
        confidence: eventData.confidence / 100, // Convert from 0-100 to 0-1
        labels: ['motion'],
        location: 'Front Door',
        duration: eventData.duration || 0,
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
