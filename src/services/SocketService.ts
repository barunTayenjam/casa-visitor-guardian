import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private isConnecting: boolean = false;

  constructor() {
    console.log('*** SOCKET SERVICE INITIALIZING ***');
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

        // In development, use localhost explicitly to avoid CORS issues
        // In production, use relative URL (nginx will proxy to backend)
        let socketUrl: string;
        if (import.meta.env.DEV) {
          // Use the Vite dev server port for development (proxy will handle it)
          socketUrl = window.location.origin;
        } else {
          // In production (Docker), use relative URL - nginx will proxy to backend
          socketUrl = window.location.origin;
        }
        
        console.log('*** SOCKET SERVICE CONNECTING TO:', socketUrl, '***');
        console.log('*** DEV MODE:', import.meta.env.DEV, '***');
        console.log('*** BACKEND_URL:', import.meta.env.VITE_BACKEND_URL, '***');
        console.log('*** WINDOW LOCATION:', window.location.href, '***');

        // Prefer polling transport for better proxy compatibility in all environments
        const transports = ['polling', 'websocket'];
        
        this.socket = io(socketUrl, {
          transports,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          maxReconnectionAttempts: 10,
          path: '/socket.io',
          timeout: 20000, // Increased timeout
          forceNew: true,
          autoConnect: true,
          randomizationFactor: 0.5,
          upgrade: true,
          rememberUpgrade: false
        });

        this.socket.on('connect', () => {
          console.log('*** SOCKET CONNECTED TO SERVER SUCCESSFULLY ***');
          console.log('*** SOCKET ID:', this.socket?.id, '***');
          this.isConnecting = false;
          
          // Re-register all callbacks when socket connects
          this.callbacks.forEach((listeners, event) => {
            listeners.forEach(callback => {
              this.socket?.on(event, callback);
            });
          });
          
          resolve();
        });

        // Listen for server confirmation
        this.socket.on('connected', (data) => {
          console.log('*** SERVER CONFIRMED CONNECTION:', data, '***');
        });

        // Listen for stream events
        this.socket.on('streamRequested', (data) => {
          console.log('*** STREAM REQUEST CONFIRMED:', data, '***');
        });

        this.socket.on('streamError', (data) => {
          console.error('*** STREAM ERROR:', data, '***');
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected from server:', reason);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('*** SOCKET CONNECTION ERROR ***');
          console.error('Error message:', error.message);
          console.error('Error type:', error.type);
          console.error('Error description:', error.description);
          console.error('Full error:', error);
          this.isConnecting = false;
          
          // Handle specific error types
          if (error.message.includes('ECONNRESET')) {
            console.log('Connection reset detected, will retry automatically...');
          } else if (error.message.includes('ECONNREFUSED')) {
            console.log('Connection refused - server may be down');
          } else if (error.message.includes('websocket error')) {
            console.log('WebSocket error detected, trying polling transport...');
          }
          
          reject(error);
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          
          // Handle ECONNRESET specifically
          if (error.message && error.message.includes('ECONNRESET')) {
            console.log('Socket connection reset, attempting reconnection...');
            // Don't reject here, let socket.io handle reconnection
          }
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
      console.warn('Socket not connected, cannot request stream.');
      return;
    }
    console.log('Requesting stream for camera:', cameraId);
    this.socket.emit('requestStream', cameraId);
  }

  // Stop streaming a camera
  stopStream(cameraId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot stop stream.');
      return;
    }
    console.log('Stopping stream for camera:', cameraId);
    this.socket.emit('stopStream', cameraId);
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