import React, { createContext, useContext, useEffect, useState } from 'react';
import socketService from '@/services/SocketService';

interface SocketContextType {
  connected: boolean;
  socket: typeof socketService;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleError = (error: Error) => {
      console.error('Socket error:', error);
      setConnected(false);
    };

    // Add event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('error', handleError);

    // Initial connection
    if (!socketService.isConnected()) {
      socketService.connect().catch((error) => {
        console.error('Failed to connect to socket server:', error);
        setConnected(false);
      });
    }

    // Cleanup on unmount
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('error', handleError);
    };
  }, []);

  const value = {
    connected,
    socket: socketService
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
};
