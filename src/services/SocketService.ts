import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<(...args: any[]) => void>> = new Map();
  private serverUrl: string;

  constructor() {
    // Get the actual backend port from the server - using the port from our recent terminal output (9754)
    this.serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:9754';
    console.log('Socket service connecting to:', this.serverUrl);
  }

  // Connect to the websocket server
  connect() {
    if (this.socket) {
      return;
    }

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
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
    if (!this.socket) {
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
    const listeners = this.callbacks.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.callbacks.delete(event);
      }
    }

    // Remove from socket if connected
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;
