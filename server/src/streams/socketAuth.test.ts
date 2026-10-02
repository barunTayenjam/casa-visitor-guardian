import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import type { Socket } from 'socket.io';

process.env.JWT_ACCESS_SECRET = 'socket-auth-test-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

describe('Socket.io JWT auth (socketAuth)', () => {
  let verifySocketAuth: (socket: Partial<Socket>) => boolean;
  let registerSocketAuth: (io: { use: (fn: unknown) => void }) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authService: any;

  beforeAll(async () => {
    ({ verifySocketAuth, registerSocketAuth } = await import('./socketAuth.js'));
    ({ authService } = await import('../auth/index.js'));
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeSocket = (handshake: any) => ({ handshake, data: {} }) as unknown as Socket;
  const user = {
    id: 'user-1',
    username: 'tester',
    email: 'tester@example.com',
    password: 'irrelevant',
    role: 'user' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a socket whose handshake.auth.token is a valid JWT', () => {
    const token = authService.generateToken(user);
    expect(verifySocketAuth(fakeSocket({ auth: { token } }))).toBe(true);
  });

  it('accepts a Bearer Authorization header as fallback', () => {
    const token = authService.generateToken(user);
    expect(
      verifySocketAuth(
        fakeSocket({ auth: {}, headers: { authorization: `Bearer ${token}` } }),
      ),
    ).toBe(true);
  });

  it('rejects a socket with no token', () => {
    expect(verifySocketAuth(fakeSocket({ auth: {} }))).toBe(false);
  });

  it('rejects an invalid JWT', () => {
    expect(verifySocketAuth(fakeSocket({ auth: { token: 'garbage' } }))).toBe(false);
  });

  it('stores the verified user payload on socket.data.user', () => {
    const token = authService.generateToken(user);
    const socket = fakeSocket({ auth: { token } }) as Socket & { data: Record<string, unknown> };
    verifySocketAuth(socket);
    expect(socket.data.user).toMatchObject({
      userId: 'user-1',
      username: 'tester',
      role: 'user',
    });
  });

  it('registerSocketAuth wires io.use and rejects unauthenticated connections', () => {
    const middlewares: Array<(socket: Partial<Socket>, next: (err?: Error) => void) => void> = [];
    registerSocketAuth({ use: (fn) => middlewares.push(fn) });
    expect(middlewares).toHaveLength(1);

    const reject = jest.fn();
    middlewares[0](fakeSocket({ auth: {} }), reject);
    expect(reject).toHaveBeenCalledWith(expect.any(Error));

    const accept = jest.fn();
    const token = authService.generateToken(user);
    middlewares[0](fakeSocket({ auth: { token } }), accept);
    expect(accept).toHaveBeenCalledWith();
  });
});
