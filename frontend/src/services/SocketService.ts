import { io, Socket } from 'socket.io-client';
import { PersonDetectedEvent, FaceDetectedEvent } from '../types/security';

class SocketService {
  private socket: Socket | null = null;
  private callbacks: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  private isConnecting: boolean = false;
  private requestedStreams: Set<string> = new Set();

  constructor() {
    const handleVisibilityChange = () => {
      if (!document.hidden && this.socket?.connected) {
        this.socket.emit('ping');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
  }

  // Connect to the websocket server
  connect(): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    // If socket exists but is disconnected/reconnecting, wait for it instead of destroying it
    if (this.socket && !this.socket.connected && !this.isConnecting) {
      return new Promise((resolve) => {
        const onConnect = () => {
          this.socket?.off('connect', onConnect);
          this.isConnecting = false;
          resolve();
        };
        const onError = () => {
          this.socket?.off('connect_error', onError);
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

    return this.createNewConnection();
  }

  private createNewConnection(): Promise<void> {
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
        }

        const socketUrl = window.location.origin;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
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
          this.isConnecting = false;

          this.callbacks.forEach((listeners, event) => {
            listeners.forEach(callback => {
              this.socket?.off(event, callback);
              this.socket?.on(event, callback);
            });
          });

          this.requestedStreams.forEach(streamKey => {
            const [cameraId, role] = streamKey.split('-') as [string, 'detect' | 'record' | 'live'];
            this.socket?.emit('requestStream', { cameraId, role });
          });
          
          resolve();
        });

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
      return;
    }

    if (!this.socket?.connected) {
      return;
    }

    this.requestedStreams.add(streamKey);
    this.socket.emit('requestStream', { cameraId, role });
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