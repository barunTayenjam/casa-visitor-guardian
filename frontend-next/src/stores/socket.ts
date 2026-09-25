import { create } from 'zustand';
import socketService from '@/services/SocketService';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface SocketState {
  connected: boolean;
  connectionStatus: ConnectionStatus;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  connectionStatus: 'connecting',

  connect: async () => {
    if (socketService.isConnected()) {
      set({ connected: true, connectionStatus: 'connected' });
      return;
    }
    set({ connectionStatus: 'connecting' });
    try {
      await socketService.connect();
      set({ connected: true, connectionStatus: 'connected' });
    } catch {
      set({ connected: false, connectionStatus: 'error' });
    }
  },

  disconnect: () => {
    socketService.disconnect();
    set({ connected: false, connectionStatus: 'disconnected' });
  },
}));

socketService.on('connect', () => {
  useSocketStore.setState({ connected: true, connectionStatus: 'connected' });
});
socketService.on('disconnect', () => {
  useSocketStore.setState({ connected: false, connectionStatus: 'disconnected' });
});
socketService.on('error', () => {
  useSocketStore.setState({ connected: false, connectionStatus: 'error' });
});
