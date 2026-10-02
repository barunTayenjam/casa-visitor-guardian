import type { Socket } from 'socket.io';
import { authService, type JWTPayload } from '../auth/index.js';
import { logger } from '../utils/logger.js';

type AuthCapableSocket = Partial<Socket> & { data?: Record<string, unknown> };

/**
 * Verify a Socket.io connection carries a valid JWT.
 * Accepts the token from handshake.auth.token (socket.io-client `auth` option)
 * or a `Authorization: Bearer <token>` handshake header.
 * Returns true and stores the payload on socket.data.user on success.
 */
export function verifySocketAuth(socket: AuthCapableSocket): boolean {
  const auth = (socket.handshake?.auth ?? {}) as { token?: string };
  const header = socket.handshake?.headers?.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = auth.token ?? bearer;
  const payload = token ? authService.verifyToken(token) : null;
  if (!payload) return false;
  socket.data = socket.data ?? {};
  socket.data.user = payload;
  return true;
}

type MiddlewareRegistrar = {
  use: (fn: (socket: AuthCapableSocket, next: (err?: Error) => void) => void) => void;
};

/** Register the auth middleware on a Socket.io server. */
export function registerSocketAuth(io: MiddlewareRegistrar): void {
  io.use((socket, next) => {
    if (verifySocketAuth(socket)) return next();
    logger.warn('Socket.io connection rejected: authentication failed', 'STREAM');
    next(new Error('Unauthorized'));
  });
}
