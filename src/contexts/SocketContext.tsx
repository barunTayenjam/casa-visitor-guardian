import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import socketService from '@/services/SocketService';

interface SocketContextType {
  connected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  socket: typeof socketService;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  const connect = useCallback(async () => {
    if (socketService.isConnected()) {
      setConnectionStatus('connected');
      return;
    }
    setConnectionStatus('connecting');
    try {
      await socketService.connect();
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Socket connection failed:', error);
      setConnectionStatus('error');
    }
  }, []);

  useEffect(() => {
    const handleConnect = () => setConnectionStatus('connected');
    const handleDisconnect = () => setConnectionStatus('disconnected');
    const handleError = () => setConnectionStatus('error');

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('error', handleError);

    connect();

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('error', handleError);
    };
  }, [connect]);

  const value = {
    connected: connectionStatus === 'connected',
    connectionStatus,
    socket: socketService,
    reconnect: connect
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
