import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/index.js';
import { extractBearerToken } from '../utils/tokenExtraction.js';

/**
 * Extract the media token from a raw request — Bearer header first, then
 * `?token=` from the URL. Works for both Express requests and bare
 * `server.on('upgrade')` requests.
 */
export function extractMediaToken(req: {
  headers: Record<string, string | string[] | undefined>;
  url?: string;
}): string | null {
  const bearer = extractBearerToken(req);
  if (bearer) return bearer;
  if (req.url) {
    try {
      return new URL(req.url, 'http://localhost').searchParams.get('token');
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * JWT gate for the /go2rtc proxy.
 * Token may come from `Authorization: Bearer <jwt>` or `?token=<jwt>`
 * — browser <video> and WebSocket clients cannot set headers.
 */
export function go2rtcAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractMediaToken(req);

  if (!token || !authService.verifyToken(token)) {
    res.status(401).json({ success: false, error: 'Authentication required for /go2rtc' });
    return;
  }
  next();
}

export default go2rtcAuth;
