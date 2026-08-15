# External Integrations & Services

> Generated: 2026-08-15 | Focus: Tech | Scope: full repo

## Databases & Storage

- **PostgreSQL 15+**: Primary persistent store for users, events, face embeddings, visitor timelines, audit logs, and system settings. Connected via TypeORM (`server/src/database.ts`) and direct psycopg2 in Python.
- **Local File System Storage**:
  - Detection image captures: `./data/detections` (configured via `DETECTIONS_DIR`)
  - Event snapshots: `./data/events`, `./public/events`
  - Timelapse video output: `./public/timelapse`
  - Face embeddings / known faces: `./opencv-service/known_faces`

## Media & Streaming Services

- **go2rtc (v1.9.14)**: RTSP-to-WebRTC/MSE/HLS bridge (`sentryvision-go2rtc`). Consumes RTSP streams from configured cameras (`server/cameras.json`) and exposes WebRTC on port 8555 and HTTP API on port 1984.
- **FFmpeg**: Subprocess capture in Python OpenCV service (`FFmpegReader`) capturing raw BGR24 frames from RTSP streams at 640x360 @ 5 FPS.

## AI & Vision Microservices

- **OpenCV Python Service (`sentryvision-opencv`)**:
  - Flask REST API on port `8084` (`/health`, analyze endpoints)
  - WebSocket publisher on port `9090` sending JPEG frames + JSON tracking events to Node.js
  - YOLOv8n / YOLOv5n / yolov4-tiny object detection chain (OpenCV DNN)
  - ByteTracker multi-object tracking (Kalman filter)
  - InsightFace ArcFace face recognition (30s identity cache)
- **NVIDIA AI Build API (`integrate.api.nvidia.com`)**:
  - LLM / Vision Scene Analysis integration (`server/src/services/nvidia/`)
  - Endpoints: `/api/nvidia/analyze`, `/api/nvidia/analyze-event`, `/api/nvidia/analyze-event-with-bboxes`, `/api/nvidia/analyze-persons`
  - Circuit breaker and retry mechanisms for API resilience (`server/src/services/nvidia/nvidiaClient.ts`)
  - Default model: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (configurable via `NVIDIA_MODEL`)

## Protocols & Real-Time Communication

- **Socket.io (v4.7)**: Real-time bidirectional communication between Frontend and Backend (live camera frames, motion alerts, event updates).
- **WebSockets (`ws`)**: Node-to-Python communication link (`pythonWsClient.ts` connecting to `ws://opencv:9090`).

## Authentication & Security

- **JWT (JSON Web Tokens)**: Access tokens and refresh tokens (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
- **TOTP / MFA**: Two-factor authentication via `speakeasy` and QR code generation (`qrcode`).
- **Credential Encryption**: AES-256-GCM encryption for stored RTSP camera credentials (`server/src/services/credentialEncryption.ts`).
- **Rate Limiting**: `express-rate-limit` counters stored in PostgreSQL (`rate_limit_counters`).

## External Notifications & Webhooks

- **Web Push**: VAPID browser push notifications (`web-push` library with public/private VAPID keys).
- **Email (SMTP)**: Optional email notifications (configured via SMTP environment variables).
- **Webhook placeholders**: Slack, Discord, Telegram webhook slots available in configuration (not actively wired).
