import React from 'react';
import { useSocketStore } from '@/stores/socket';
import socketService from '@/services/SocketService';

export const useSocketContext = () => {
  const { connected, connectionStatus, connect } = useSocketStore();
  return {
    connected,
    connectionStatus,
    socket: socketService,
    reconnect: connect,
  };
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
