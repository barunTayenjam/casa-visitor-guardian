# Security

## Authentication

- **JWT** access tokens (short-lived) + refresh tokens (stored in `user_sessions`)
- **MFA** via TOTP (speakeasy). Setup → verify → challenge flow.
- **Password requirements**: 8+ chars, uppercase, lowercase, number, special character
- **Password history** prevents reuse (bcrypt, 14 rounds)
- **Account lockout** after failed login attempts
- **Session tracking** with device/IP information

## Authorization

| Middleware | Requirement |
|------------|-------------|
| `optionalAuth` | JWT if present, no rejection |
| `requireUser` | Logged-in user |
| `requireAdmin` | Admin role only |
| `authenticate({ roles: [...] })` | Specific role(s) |

## Rate Limiting

| Limiter | Scope | Purpose |
|---------|-------|---------|
| `createApiRateLimit()` | Global | Prevent API abuse |
| `createAuthRateLimit()` | Login/register | Prevent brute force |
| `createMfaRateLimit()` | MFA verify/challenge | Prevent MFA bypass attempts |
| `createDetectionRateLimit()` | Detection endpoints | Prevent inference overload |

## Input Validation

All inputs validated with **Zod schemas** in `middleware/zodValidation.ts`:
- `validateBody(schema)` — request body
- `validateQuery(schema)` — query params
- `validateParams(schema)` — URL params

Path traversal blocked in file-serving routes (`..`, `/`, `\` rejected).

## Headers

Helmet.js with strict CSP:
- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob:`
- `connect-src 'self' ws: wss:`
- `media-src 'self' blob: data:`
- `worker-src 'self' blob:`
- HSTS in production

## Data Protection

- **Camera credentials** encrypted at rest (`CREDENTIAL_ENCRYPTION_KEY`)
- **MFA secrets** encrypted in database
- **Audit logs** digitally signed for tamper detection
- **Sensitive data** excluded from logs

## Network

- Single-port deployment (9753) — smaller attack surface
- go2rtc WebSocket proxy strips auth headers (`Authorization`, `Cookie`) before forwarding
- go2rtc bound to `127.0.0.1` for management API (1984), public only for WebRTC (8555)
- PostgreSQL bound to `127.0.0.1` in Docker
- OpenCV service bound to `127.0.0.1` in Docker

## WebSocket Security

- Socket.io respects CORS origins
- No auth on stream frames (LAN-only assumption)
- Camera rooms prevent cross-camera frame leakage

## Known Risks

| Risk | Status | Mitigation |
|------|--------|------------|
| No reverse proxy | Open | Use Caddy/Traefik for HTTPS in production |
| Self-signed HTTPS | Open | LAN-only or VPN/Tailscale recommended |
| No ONVIF auth | Accepted | RTSP cameras only, credentials encrypted |
| In-memory sessions | Accepted | Single-container deployment assumption |
| `unsafe-inline` styles | Accepted | Required for TailwindCSS |
