import { io } from 'socket.io-client';
import socketService from '../services/SocketService';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mSocket = {
    connected: false,
    emit: jest.fn(),
    on: jest.fn((event, cb) => {
      if (event === 'connect') {
        mSocket.connected = true;
        cb();
      }
    }),
    off: jest.fn(),
    disconnect: jest.fn(() => {
      mSocket.connected = false;
    }),
    removeAllListeners: jest.fn(),
  };
  return {
    io: jest.fn(() => mSocket),
  };
});

// No manual window.location mock, relying on JSDOM defaults


afterEach(() => {
  jest.restoreAllMocks();
});

describe('SocketService', () => {
  let socket: ReturnType<typeof io>;

  beforeEach(async () => {
    jest.clearAllMocks();
    socketService.disconnect();
    await socketService.connect();
    socket = io();
  });

  it('should connect', async () => {
    await socketService.connect();
    expect(socket.connected).toBe(true);
  });

  it('should subscribe to events', () => {
    const callback = jest.fn();
    const off = socketService.on('testEvent', callback);

    expect(socket.on).toHaveBeenCalledWith('testEvent', expect.any(Function));

    off();
    expect(socket.off).toHaveBeenCalledWith('testEvent', expect.any(Function));
  });

  it('should disconnect', () => {
    socketService.disconnect();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
