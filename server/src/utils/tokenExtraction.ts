/**
 * Extract Bearer token from an Authorization header.
 * Works with Express requests, Socket.io handshakes, and raw `upgrade`
 * requests (where the header may arrive as an array).
 * Returns null if absent or malformed.
 */
export function extractBearerToken(req: {
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  const raw = req.headers?.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  return token || null;
}