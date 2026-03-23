import { io, Socket } from 'socket.io-client';
import { PersonDetectedEvent, FaceDetectedEvent } from '../types/security';

class SocketService {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private isConnecting: boolean = false;
  private requestedStreams: Set<string> = new Set();

  constructor() {
    // Socket service initialized
  }

  // Connect to the websocket server
  connect(): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
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

        // Use relative URL in development to leverage Vite proxy
        // In production, use relative URL (nginx will proxy to backend)
        let socketUrl: string;
        if (import.meta.env.DEV) {
          // In development, use relative URL to leverage Vite proxy
          socketUrl = window.location.origin;
        } else {
          // In production (Docker), use relative URL - nginx will proxy to backend
          socketUrl = window.location.origin;
        }


        // Mobile detection for transport configuration
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Prefer websocket transport for better streaming performance
        // WebSocket handles large binary frames (~500KB) much better than polling
        // Mobile: use polling first (better compatibility), then upgrade to WebSocket
        const transports = isMobile ? ['polling', 'websocket'] : ['websocket', 'polling'];

        this.socket = io(socketUrl, {
          transports,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          path: '/socket.io',
          timeout: isMobile ? 30000 : 20000,
          forceNew: false,
          autoConnect: true,
          randomizationFactor: 0.5,
          upgrade: true,
          rememberUpgrade: true
        });

        this.socket.on('connect', () => {
          console.log('✅ SocketService: Socket connected successfully');
          this.isConnecting = false;
          
          // Re-register all callbacks when socket connects
          this.callbacks.forEach((listeners, event) => {
            console.log(`🔄 SocketService: Re-registering ${listeners.size} listeners for event: ${event}`);
            listeners.forEach(callback => {
              this.socket?.on(event, callback);
            });
          });
          
          resolve();
        });

        // Listen for server confirmation
        this.socket.on('connected', (data) => {
          // Server confirmed connection
        });

        // Listen for stream events
        this.socket.on('streamRequested', (data) => {
          // Stream request confirmed
        });

        this.socket.on('streamError', (data) => {
          console.error('Stream error:', data);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
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

        // Detection event listeners
        this.socket.on('personDetected', (data) => {
          // Person detected event
        });

        this.socket.on('faceDetected', (data) => {
          // Face detected event
        });

        this.socket.on('enhancedMotionDetected', (data) => {
          // Enhanced motion detected event
        });

        // Frame event listener for debugging
        this.socket.on('frame', (data) => {
          console.log(`🖼️ SocketService: Raw frame received for camera ${data.cameraId}, size: ${data.data?.length || 0}`);
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
  requestStream(cameraId: string, role: 'detect' | 'record' | 'live' = 'live') {
    const streamKey = `${cameraId}-${role}`;

    if (this.requestedStreams.has(streamKey)) {
      console.log(`⚠️ SocketService: Stream already requested for ${streamKey}, skipping`);
      return;
    }

    console.log(`📡 SocketService: Requesting stream for camera ${cameraId} role ${role}, socket connected: ${this.socket?.connected}`);
    if (!this.socket?.connected) {
      console.warn('❌ Socket not connected, cannot request stream');
      return;
    }

    this.requestedStreams.add(streamKey);
    this.socket.emit('requestStream', { cameraId, role });
    console.log(`✅ SocketService: Stream request emitted for camera ${cameraId} role ${role}`);
  }

  // Stop streaming a camera
  stopStream(cameraId: string, role: 'detect' | 'record' | 'live' = 'live') {
    const streamKey = `${cameraId}-${role}`;
    this.requestedStreams.delete(streamKey);

    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('stopStream', { cameraId, role });
  }

  // Add event listener
  on(event: string, callback: (...args: unknown[]) => void) {
    console.log(`👂 SocketService: Registering listener for event: ${event}`);
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }

    this.callbacks.get(event)?.add(callback);

    // If socket is already connected, add the listener directly
    if (this.socket?.connected) {
      console.log(`🔌 SocketService: Socket connected, adding listener for ${event}`);
      this.socket.on(event, callback);
    } else {
      console.log(`⚠️ SocketService: Socket not connected, listener queued for ${event}`);
    }

    return () => this.off(event, callback);
  }

  // Convenience method for person detection events
    onPersonDetected(callback: (data: PersonDetectedEvent) => void) {
    return this.on('personDetected', callback as (...args: unknown[]) => void);
  }

  // Convenience method for face detection events
  onFaceDetected(callback: (data: FaceDetectedEvent) => void) {
    return this.on('faceDetected', callback as (...args: unknown[]) => void);
  }

  // Convenience method for enhanced motion events
  onEnhancedMotionDetected(callback: (data: any) => void) {
    return this.on('enhancedMotionDetected', callback);
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