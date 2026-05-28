import WebSocket from 'ws';
import { EventEmitter } from 'node:events';

interface FrameMessage {
  cameraId: string | null;
  data: Buffer;
  timestamp: number;
}

export class PythonWsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private _connected = false;

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

    this.ws.on('message', (data: Buffer) => {
      const message: FrameMessage = {
        cameraId: null,
        data,
        timestamp: Date.now()
      };
      this.emit('frame', message);
    });

    this.ws.on('close', () => {
      this._connected = false;
      this.emit('disconnected');
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
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
      this.ws.send(JSON.stringify({ type: 'subscribe', cameraId }));
    }
  }

  unsubscribe(cameraId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', cameraId }));
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
