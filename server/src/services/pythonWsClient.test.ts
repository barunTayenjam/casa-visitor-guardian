import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PythonWsClient } from './pythonWsClient.js';
import WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'node:net';

/**
 * Helper: create a WebSocketServer on a random port and resolve with the port.
 */
function createMockServer(): Promise<{ server: WebSocketServer; port: number }> {
  return new Promise((resolve) => {
    const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    server.on('listening', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, port: address.port });
    });
  });
}

describe('PythonWsClient', () => {
  let client: PythonWsClient;
  let mockServer: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    const created = await createMockServer();
    mockServer = created.server;
    port = created.port;
    client = new PythonWsClient(`ws://127.0.0.1:${port}`);
  });

  afterEach(() => {
    client.disconnect();
    mockServer.close();
  });

  it('should connect to WebSocket server and emit connected', (done) => {
    mockServer.on('connection', () => {
      // Server received connection
    });

    client.on('connected', () => {
      expect(client.connected).toBe(true);
      done();
    });

    client.connect();
  });

  it('should emit frame on binary message', (done) => {
    const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);

    client.on('connected', () => {
      // Small delay to ensure connection is fully established
      setTimeout(() => {
        const clients = [...mockServer.clients];
        const serverWs = clients[0];
        // The client expects a JSON frame metadata message before the binary payload
        serverWs.send(JSON.stringify({ type: 'frame', cameraId: null, timestamp: Date.now() }));
        serverWs.send(testBuffer);
      }, 50);
    });

    client.on('frame', (message: { cameraId: string | null; data: Buffer; timestamp: number }) => {
      expect(message.data).toEqual(testBuffer);
      expect(message.cameraId).toBeNull();
      expect(typeof message.timestamp).toBe('number');
      done();
    });

    client.connect();
  });

  it('should emit disconnected on server close', (done) => {
    client.on('connected', () => {
      // Close the server-side WebSocket to trigger client disconnect
      const clients = [...mockServer.clients];
      clients[0].close();
    });

    client.on('disconnected', () => {
      expect(client.connected).toBe(false);
      done();
    });

    client.connect();
  });

  it('should reconnect with exponential backoff', (done) => {
    const initialDelay = 1000;

    // After first disconnect, reconnectDelay should double
    client.on('connected', () => {
      // Close the server-side WebSocket to trigger client reconnection
      const clients = [...mockServer.clients];
      clients[0].close();
    });

    client.on('disconnected', () => {
      // After disconnect, reconnectDelay should have doubled
      const delay = (client as any).reconnectDelay as number;
      expect(delay).toBe(initialDelay * 2);
      done();
    });

    client.connect();
  });

  it('should send subscribe message as JSON', (done) => {
    mockServer.on('connection', (serverWs) => {
      serverWs.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        expect(message).toEqual({ type: 'subscribe', cameraId: 'cam1' });
        done();
      });
    });

    client.on('connected', () => {
      client.subscribe('cam1');
    });

    client.connect();
  });

  it('should send unsubscribe message as JSON', (done) => {
    mockServer.on('connection', (serverWs) => {
      serverWs.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        expect(message).toEqual({ type: 'unsubscribe', cameraId: 'cam1' });
        done();
      });
    });

    client.on('connected', () => {
      client.unsubscribe('cam1');
    });

    client.connect();
  });

  it('should pair each camera binary frame with that camera own metadata when interleaved', (done) => {
    // Wave 5: single pendingMetadata slot pairs camA frame with camB metadata
    // when two cameras stream interleaved on one connection:
    //   metaA, metaB, binA, binB  =>  binA must emit cameraId 'camA', binB 'camB'
    const frameA = Buffer.from([0xaa, 0xaa]);
    const frameB = Buffer.from([0xbb, 0xbb]);
    const received: Array<{ cameraId: string | null; data: Buffer }> = [];

    client.on('connected', () => {
      setTimeout(() => {
        const serverWs = [...mockServer.clients][0];
        serverWs.send(JSON.stringify({ type: 'frame', cameraId: 'camA', timestamp: 1000 }));
        serverWs.send(JSON.stringify({ type: 'frame', cameraId: 'camB', timestamp: 2000 }));
        serverWs.send(frameA);
        serverWs.send(frameB);
      }, 50);
    });

    client.on('frame', (message: { cameraId: string | null; data: Buffer }) => {
      received.push({ cameraId: message.cameraId, data: message.data });
      if (received.length === 2) {
        const byCamera = new Map(received.map((r) => [r.cameraId, r.data]));
        expect(byCamera.get('camA')).toEqual(frameA);
        expect(byCamera.get('camB')).toEqual(frameB);
        done();
      }
    });

    client.connect();
  });

  it('should drop binary frame when no metadata pending for that camera', (done) => {
    // A binary frame arriving with no pending metadata for its camera must be
    // dropped, not emitted with a null/wrong cameraId.
    let frameEmitted = false;

    client.on('connected', () => {
      setTimeout(() => {
        const serverWs = [...mockServer.clients][0];
        // Only send binary — no metadata at all
        serverWs.send(Buffer.from([0xde, 0xad]));
        setTimeout(() => {
          if (!frameEmitted) done();
        }, 300);
      }, 50);
    });

    client.on('frame', () => {
      frameEmitted = true;
    });

    client.connect();
  });

  it('should disconnect cleanly without pending timers', () => {
    jest.useFakeTimers();

    client.connect();
    client.disconnect();

    expect((client as any).reconnectTimer).toBeNull();
    expect((client as any).ws).toBeNull();
    expect(client.connected).toBe(false);

    jest.useRealTimers();
  });
});
