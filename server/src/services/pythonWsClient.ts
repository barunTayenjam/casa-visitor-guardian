import WebSocket from 'ws';
import { EventEmitter } from 'node:events';

interface FrameMetadata {
  cameraId: string | null;
  timestamp: number;
}

interface FrameMessage {
  cameraId: string | null;
  data: Buffer;
  timestamp: number;
}

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  cameraId: string;
}

export class PythonWsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private _connected = false;
  private pendingMetadata: FrameMetadata | null = null;

  constructor(url?: string) {
    super();
    this.url = url || 'ws://opencv:9090';
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[PythonWsClient] Already connected or connecting, skipping');
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('[PythonWsClient] Connected');
      this.reconnectDelay = 1000;
      this._connected = true;
      this.emit('connected');
    });

    this.ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
      if (isBinary) {
        const metadata = this.pendingMetadata;
        this.pendingMetadata = null;
        if (!metadata) {
          return;
        }
        const message: FrameMessage = {
          cameraId: metadata.cameraId,
          data: data as Buffer,
          timestamp: metadata.timestamp,
        };
        this.emit('frame', message);
      } else {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'frame') {
            this.pendingMetadata = {
              cameraId: parsed.cameraId || null,
              timestamp: parsed.timestamp || Date.now(),
            };
          }
        } catch {
          // ignore malformed messages
        }
      }
    });

    this.ws.on('close', () => {
      this._connected = false;
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.emit('disconnected');
    });

    this.ws.on('error', (err: Error) => {
      console.error(`[PythonWsClient] Error: ${err.message}`);
    });
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  subscribe(cameraId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg: SubscriptionMessage = { type: 'subscribe', cameraId };
      this.ws.send(JSON.stringify(msg));
    }
  }

  unsubscribe(cameraId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg: SubscriptionMessage = { type: 'unsubscribe', cameraId };
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }
}
