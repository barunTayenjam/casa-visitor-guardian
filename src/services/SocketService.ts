import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor() {
    // In development, use relative URL so vite proxy handles it
    console.log('Socket service initializing');
  }

  // Connect to the websocket server
  connect() {
    if (this.socket) {
      return;
    }

    // In development, use relative URL so vite proxy handles it
    // In production, use the BACKEND_URL from env
    const socketUrl = import.meta.env.DEV ? '' : import.meta.env.VITE_BACKEND_URL;
    console.log('Socket service connecting to:', socketUrl || 'relative URL');

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: '/socket.io'
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Setup event listeners from our callback map
    this.callbacks.forEach((listeners, event) => {
      listeners.forEach(callback => {
        this.socket?.on(event, callback);
      });
    });
  }

  // Disconnect from the websocket server
  disconnect() {
    if (!this.socket) {
      return;
    }

    this.socket.disconnect();
    this.socket = null;
  }

  // Request a camera stream
  requestStream(cameraId: string) {
    if (!this.socket?.connected) {
      this.connect();
    }
    this.socket?.emit('requestStream', cameraId);
  }

  // Stop streaming a camera
  stopStream(cameraId: string) {
    this.socket?.emit('stopStream', cameraId);
  }

  // Add event listener
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }

    this.callbacks.get(event)?.add(callback);

    // If socket is already connected, add the listener directly
    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => this.off(event, callback);
  }

  // Remove event listener
  off(event: string, callback: (...args: any[]) => void) {
    this.callbacks.get(event)?.delete(callback);
    this.socket?.off(event, callback);
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;
