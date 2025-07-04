import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private isConnecting: boolean = false;

  constructor() {
    console.log('Socket service initializing');
  }

  // Connect to the websocket server
  connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return Promise.resolve();
    }

    if (this.isConnecting) {
      console.log('Socket connection already in progress');
      return new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve();
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        // Clean up existing socket if any
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
        }

        // In development, use relative URL so vite proxy handles it
        // In production, use the BACKEND_URL from env
        const socketUrl = import.meta.env.DEV ? '' : import.meta.env.VITE_BACKEND_URL;
        console.log('Socket service connecting to:', socketUrl || 'relative URL (via proxy)');

        this.socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
          path: '/socket.io',
          timeout: 10000,
          forceNew: true
        });

        this.socket.on('connect', () => {
          console.log('Socket connected to server successfully');
          this.isConnecting = false;
          
          // Re-register all callbacks when socket connects
          this.callbacks.forEach((listeners, event) => {
            listeners.forEach(callback => {
              this.socket?.on(event, callback);
            });
          });
          
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected from server:', reason);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error.message);
          this.isConnecting = false;
          reject(error);
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
        });

        // Set a timeout for connection
        setTimeout(() => {
          if (!this.socket?.connected) {
            this.isConnecting = false;
            reject(new Error('Socket connection timeout after 10 seconds'));
          }
        }, 10000);
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // Disconnect from the websocket server
  disconnect() {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.isConnecting = false;
  }

  // Request a camera stream
  requestStream(cameraId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, attempting to connect first...');
      this.connect().then(() => {
        this.socket?.emit('requestStream', cameraId);
      }).catch(error => {
        console.error('Failed to connect socket for stream request:', error);
      });
      return;
    }
    console.log('Requesting stream for camera:', cameraId);
    this.socket.emit('requestStream', cameraId);
  }

  // Stop streaming a camera
  stopStream(cameraId: string) {
    if (this.socket?.connected) {
      console.log('Stopping stream for camera:', cameraId);
      this.socket.emit('stopStream', cameraId);
    }
  }

  // Add event listener
  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }

    this.callbacks.get(event)?.add(callback);

    // If socket is already connected, add the listener directly
    if (this.socket?.connected) {
      this.socket.on(event, callback);
    }

    return () => this.off(event, callback);
  }

  // Remove event listener
  off(event: string, callback: (...args: unknown[]) => void) {
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