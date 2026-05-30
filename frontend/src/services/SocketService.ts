import { io, Socket } from 'socket.io-client';
import { PersonDetectedEvent, FaceDetectedEvent } from '../types/security';

class SocketService {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private isConnecting: boolean = false;
  private requestedStreams: Set<string> = new Set();

  constructor() {
    console.log('[STREAM] SocketService constructor');
    
    const handleVisibilityChange = () => {
      if (!document.hidden && this.socket?.connected) {
        console.log('[STREAM] Page visible, checking transport health');
        this.socket.emit('ping');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
  }

  // Connect to the websocket server
  connect(): Promise<void> {
    console.log('[STREAM] SocketService.connect() called, connected:', this.socket?.connected, 'isConnecting:', this.isConnecting);
    
    if (this.socket?.connected) {
      console.log('[STREAM] Socket already connected, returning immediately');
      return Promise.resolve();
    }

    // If socket exists but is disconnected/reconnecting, wait for it instead of destroying it
    if (this.socket && !this.socket.connected && !this.isConnecting) {
      console.log('[STREAM] Socket exists but disconnected — waiting for reconnection');
      return new Promise((resolve) => {
        const onConnect = () => {
          console.log('[STREAM] Existing socket reconnected');
          this.socket?.off('connect', onConnect);
          this.isConnecting = false;
          resolve();
        };
        const onError = () => {
          this.socket?.off('connect_error', onError);
          console.log('[STREAM] Existing socket reconnect failed, will create new one');
          this.isConnecting = false;
          this.socket?.removeAllListeners();
          this.socket?.disconnect();
          this.socket = null;
          resolve(this.createNewConnection());
        };
        this.socket?.on('connect', onConnect);
        this.socket?.on('connect_error', onError);
        setTimeout(() => {
          if (this.socket && !this.socket.connected) {
            this.socket?.off('connect', onConnect);
            this.socket?.off('connect_error', onError);
            this.isConnecting = false;
            resolve(this.createNewConnection());
          }
        }, 5000);
      });
    }

    if (this.isConnecting) {
      console.log('[STREAM] Socket connection already in progress, awaiting');
      return new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.socket?.connected) {
            console.log('[STREAM] Awaiting connection resolved');
            resolve();
          } else if (!this.isConnecting) {
            console.log('[STREAM] Awaiting connection failed');
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    return this.createNewConnection();
  }

  private createNewConnection(): Promise<void> {
    console.log('[STREAM] Creating new socket connection');
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        if (this.socket) {
          console.log('[STREAM] Cleaning up existing socket before reconnect');
          this.socket.removeAllListeners();
          this.socket.disconnect();
        }

        const socketUrl = window.location.origin;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const transports = isMobile ? ['polling', 'websocket'] : ['websocket', 'polling'];

        console.log('[STREAM] Creating new socket connection to:', socketUrl, 'transports:', transports);
        console.log('[STREAM] VITE_BACKEND_URL:', import.meta.env.VITE_BACKEND_URL);

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
          console.log('[STREAM] ✅ Socket connected! Transport:', this.socket?.io?.engine?.transport?.name);
          this.isConnecting = false;

          console.log('[STREAM] Re-registering', this.callbacks.size, 'event callback groups on reconnect');
          this.callbacks.forEach((listeners, event) => {
            listeners.forEach(callback => {
              this.socket?.off(event, callback);
              this.socket?.on(event, callback);
            });
          });

          console.log('[STREAM] Re-requesting', this.requestedStreams.size, 'previously active streams');
          this.requestedStreams.forEach(streamKey => {
            const [cameraId, role] = streamKey.split('-') as [string, 'detect' | 'record' | 'live'];
            console.log('[STREAM] Re-requesting stream:', cameraId, role);
            this.socket?.emit('requestStream', { cameraId, role });
          });
          
          resolve();
        });

        this.socket.on('streamStarted', (data) => {
          console.log('[STREAM] 📡 streamStarted received:', data);
        });

        this.socket.on('streamStopped', (data) => {
          console.log('[STREAM] ⏹ streamStopped received:', data);
        });

        this.socket.on('streamError', (data) => {
          console.error('[STREAM] ❌ streamError received:', data);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[STREAM] 🔌 Socket disconnected, reason:', reason);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('[STREAM] ❌ Socket connect_error:', error.message, error);
          this.isConnecting = false;
          reject(error);
        });

        this.socket.on('error', (error) => {
          console.error('[STREAM] ❌ Socket error:', error);
        });

        this.socket.on('frame', (data) => {
          const isBinary = data?.data instanceof ArrayBuffer || data?.data instanceof Uint8Array;
          console.log('[STREAM] 🖼 frame event received cameraId:', data?.cameraId, 'binary:', isBinary, 'size:', isBinary ? data.data.byteLength : 'N/A');
        });

        setTimeout(() => {
          if (!this.socket?.connected) {
            console.log('[STREAM] ⏱ Socket connection timeout after 10s');
            this.isConnecting = false;
            reject(new Error('Socket connection timeout after 10 seconds'));
          }
        }, 10000);
      } catch (error) {
        console.error('[STREAM] ❌ Socket creation error:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // Disconnect from the websocket server
  disconnect() {
    console.log('[STREAM] SocketService.disconnect() called');
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
    console.log('[STREAM] requestStream called:', cameraId, role, 'streamKey:', streamKey);

    if (this.requestedStreams.has(streamKey)) {
      console.log('[STREAM] requestStream — already requested, skipping:', streamKey);
      return;
    }

    if (!this.socket?.connected) {
      console.log('[STREAM] requestStream — socket NOT connected, cannot send! requestedStreams size:', this.requestedStreams.size);
      return;
    }

    this.requestedStreams.add(streamKey);
    console.log('[STREAM] requestStream — emitting to server:', { cameraId, role });
    this.socket.emit('requestStream', { cameraId, role });
  }

  // Stop streaming a camera
  stopStream(cameraId: string, role: 'detect' | 'record' | 'live' = 'live') {
    const streamKey = `${cameraId}-${role}`;
    console.log('[STREAM] stopStream called:', cameraId, role);
    this.requestedStreams.delete(streamKey);

    if (!this.socket?.connected) {
      console.log('[STREAM] stopStream — socket NOT connected, cannot send');
      return;
    }
    this.socket.emit('stopStream', { cameraId, role });
  }

  // Add event listener
  on(event: string, callback: (...args: unknown[]) => void) {
    console.log('[STREAM] SocketService.on() registering:', event);
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }

    this.callbacks.get(event)?.add(callback);

    if (this.socket?.connected) {
      this.socket.on(event, callback);
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
  onEnhancedMotionDetected(callback: (data: Record<string, unknown>) => void) {
    return this.on('enhancedMotionDetected', callback);
  }

  // Remove event listener
  off(event: string, callback: (...args: unknown[]) => void) {
    console.log('[STREAM] SocketService.off() unregistering:', event);
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