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
    const handleConnect = () => {
      console.log('Socket context: Connected');
      setConnected(true);
    };
    
    const handleDisconnect = () => {
      console.log('Socket context: Disconnected');
      setConnected(false);
    };
    
    const handleError = (error: Error) => {
      console.error('Socket context error:', error);
      setConnected(false);
    };

    // Add event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('error', handleError);

    // Initial connection with retry
    const connectWithRetry = async (retries = 3) => {
      if (!socketService.isConnected()) {
        try {
          await socketService.connect();
          console.log('Socket context: Initial connection successful');
        } catch (error) {
          console.error('Socket context: Failed to connect:', error);
          setConnected(false);
          
          if (retries > 0) {
            console.log(`Socket context: Retrying connection in 2 seconds... (${retries} retries left)`);
            setTimeout(() => connectWithRetry(retries - 1), 2000);
          }
        }
      } else {
        setConnected(true);
      }
    };

    connectWithRetry();

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
