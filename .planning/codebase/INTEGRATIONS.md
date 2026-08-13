---
mapped: 2026-08-13
focus: tech
---

# External Integrations

> Generated from codebase analysis on 2026-08-13

## Databases

- **PostgreSQL 15+**: Central data store for auth, events, settings, and detection metadata. Connected via TypeORM in `server/src/database.ts` using `pg` driver.

## External APIs

- **NVIDIA AI API**: Used via `NVIDIA_API_KEY` for advanced scene analysis. Configured in `server/src/services/nvidiaAnalysisService.ts`.
- **RTSP Streams**: External camera feeds integrated via `server/cameras.json` and processed through `go2rtc` and `opencv-service`.

## Authentication Providers

- **JWT-based**: Custom auth implementation using `jsonwebtoken` for access/refresh token patterns, `bcrypt` for password hashing, and `speakeasy` for TOTP/MFA. Handled in `server/src/controllers/AuthController.ts` and `server/src/middleware/auth.ts`.

## Message Queues / Event Systems

- **Socket.io**: Used for real-time WebSocket communication between client and server for events and live camera frames.
- **Node EventEmitter**: Used internally for event routing within the server.

## Webhooks

- **Incoming**: None explicitly defined in public routes; events are mostly polled or received via WebSocket.
- **Outgoing**: `web-push` library usage suggests support for web push notifications for alerts.

## Third-Party Services

- **go2rtc**: Acts as a bridge for camera RTSP feeds to WebRTC, integrated via `server/src/index.ts` proxying.
- **FFmpeg**: Subprocess execution for RTSP frame capture in `opencv-service`.
- **Redis (Optional)**: Support configured but generally `REDIS_DISABLED=true`.
