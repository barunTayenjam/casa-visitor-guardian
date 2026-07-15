# External Integrations

**Last updated:** 2026-07-16
**Focus:** External service integration analysis

## Databases

| Database | Purpose | Connection | ORM / Client |
|----------|---------|------------|-------------|
| PostgreSQL 15+ | Primary data store — events, users, cameras, detections, notifications, audit logs | `DB_HOST:DB_PORT` env vars (default: `localhost:5432`) | TypeORM (Node.js, `server/src/database.ts`), `pg` raw driver (Node.js + Python), `psycopg2-binary` (Python) |
| Redis (optional) | Cache layer for detections, rate limiting | `REDIS_HOST:REDIS_PORT` env vars (default: `redis:6379`) | `ioredis` (Node.js, `server/src/services/cacheService.ts`), `redis-py` (Python, `opencv-service/pipeline.py`) |

**Database connection details:**
- Database name: `sentryvision`
- User: `sentryvision`
- 26 SQL migrations in `database/migrations/`
- OpenCV service connects directly to PostgreSQL for detection caching (`DetectionCache` in `opencv-service/pipeline.py`)
- Redis is disabled by default in Docker Compose (`REDIS_DISABLED=true`) — application falls back to in-memory cache

## External APIs

| Service | Endpoint | Auth Method | Usage |
|---------|----------|-------------|-------|
| NVIDIA AI Vision API | `https://integrate.api.nvidia.com/v1/chat/completions` | Bearer token (`NVIDIA_API_KEY`) | Scene analysis, threat detection, entity description — sends base64 image + YOLO context for AI reasoning (`server/src/services/nvidia/nvidiaClient.ts`) |
| go2rtc (internal) | `http://go2rtc:1984` | None (internal network) | RTSP to WebRTC proxy — proxied at `/go2rtc` from backend (`server/src/index.ts`) |
| OpenCV Microservice (internal) | `http://opencv:8084` (Docker) / `http://localhost:8084` (dev) | None (internal network) | Object detection, face recognition, motion detection, scene/person/threat analysis via REST (`server/src/services/opencvMicroserviceClient.ts`) |

### OpenCV Microservice REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check (returns status, model info, cache info) |
| `/status` | GET | Detailed service status |
| `/detect-objects` | POST | Object detection via YOLO (image binary) |
| `/recognize-faces` | POST | Face recognition (uses InsightFace ArcFace) |
| `/detect-motion` | POST | Motion detection (MOG2 background subtraction) |
| `/detect-batch` | POST | Batch object detection |
| `/detect-batch-paths` | POST | Batch detection from file paths |
| `/detect-and-draw` | POST | Object detection + annotated image response |
| `/analyze-scene` | POST | Scene context analysis |
| `/analyze-persons` | POST | Person attribute analysis |
| `/analyze-threat` | POST | Threat level assessment |
| `/train-face` | POST | Add face training image |
| `/retrain-model` | POST | Retrain face recognition model |
| `/known-faces` | GET | List known faces |
| `/api/config` | POST | Push detection config to pipeline |
| `/api/rtsp/metrics` | GET | RTSP stream metrics |

## WebSocket Connections

| Connection | Direction | Protocol | Port | Purpose |
|------------|-----------|----------|------|---------|
| Python → Node.js | Bidirectional | WebSocket (raw) | 9090 | Live camera frames + tracking events from OpenCV to backend (`server/src/services/pythonWsClient.ts`, `opencv-service/rtsp_ingestion/websocket_publisher.py`) |
| Node.js → Browser | Bidirectional | Socket.io | 9753 | Live frames, motion alerts, real-time updates to frontend (`frontend/src/services/SocketService.ts`) |
| Frontend ↔ go2rtc | Browser ↔ Service | WebRTC (via go2rtc proxy) | 8555 TCP+UDP | Low-latency camera stream display in browser |

### Python-to-Node.js WebSocket Protocol

- **Text frames (metadata):** JSON with `type: "frame"` or `type: "event"` plus cameraId, timestamp
- **Binary frames (data):** JPEG image bytes (following text metadata)
- **Client commands (incoming):** `{"type":"subscribe","cameraId":"..."}`, `{"type":"unsubscribe","cameraId":"..."}`
- **Event types:** `track_started`, `track_updated`, `track_ended` with bbox, class, score, identity fields
- **Reconnection:** Exponential backoff (1s → 30s max), silence monitor (60s timeout)

## Authentication Providers

| Provider | Protocol | Usage |
|----------|----------|-------|
| Local (JWT) | `jsonwebtoken` | Access + refresh token pair (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) — `server/src/middleware/auth.ts` |
| TOTP / MFA | `speakeasy` | Time-based one-time passwords for multi-factor auth — `server/src/controllers/AuthController.ts` |

**JWT configuration:**
- Access token: 15m expiry
- Refresh token: 7d expiry
- Secrets: 256-bit (generated via `openssl rand -base64 32`)

## Web Push Notifications

| Feature | Protocol | Details |
|---------|----------|---------|
| Browser push notifications | Web Push API (VAPID) | `web-push` library (`server/src/services/notificationService.ts`) |
| VAPID keys | Auto-generated on first start | Persisted to `/data/vapid/` or configurable via `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` env vars |
| Notification types | `motion`, `face`, `object`, `system` | Sent to all subscribed users, respecting per-user quiet hours and preference toggles |
| Subscriptions | Stored in `notification_subscriptions` table | Expired subscriptions (410) auto-marked inactive |

## Webhooks & Events

| Event | Source | Destination | Format |
|-------|--------|-------------|--------|
| Tracking events | OpenCV Python pipeline | Node.js backend | WebSocket JSON (track_id, class, bbox, identity) |
| Live frames | OpenCV Python pipeline | Node.js backend | WebSocket (binary JPEG) |
| Detection events | Node.js backend | Browser clients | Socket.io events |
| System events | Node.js internal | Browser clients | Socket.io events |

**Outgoing webhook configuration** (configured via `.env.example` but not implemented in code):
- `WEBHOOK_URL` — generic webhook endpoint
- `SLACK_WEBHOOK` — Slack integration
- `DISCORD_WEBHOOK` — Discord integration
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — Telegram bot

## Integration Patterns

- **Error handling:**
  - OpenCV client (`opencvMicroserviceClient.ts`): Axios with interceptors for logging, file existence checks before requests, typed error wrapping
  - Python WS client (`pythonWsClient.ts`): Connection timeouts (10s), silence monitors (60s), exponential backoff reconnection
  - NVIDIA client (`nvidiaClient.ts`): 3 retries with exponential backoff (1s → 2s → 4s + jitter), typed error handling
- **Retry logic:**
  - NVIDIA API calls: max 3 retries, exponential backoff (2^n + random jitter, capped at 5s)
  - Python WS client: exponential backoff from 1s to 30s max
  - OpenCV health checks: cached for 30s interval, retry on failure
- **Rate limiting:**
  - `express-rate-limit` middleware for API endpoints (`server/src/middleware/enhancedRateLimit.ts`)
  - `flask-limiter` for OpenCV Service Python endpoints
  - Redis-backed rate limit counters with in-memory fallback
- **Circuit breaking:** Not detected (no formal circuit breaker implementation — retry patterns only)
- **Caching strategy:**
  - Redis (primary) → in-memory Map (fallback) for both Node.js and Python services
  - TTL: 30min default (Node.js), 5min (Python detection cache)
  - Detection result caching by file hash (MD5 of path + size + mtime)

## Third-Party Services

| Service | Purpose | Integration Type |
|---------|---------|------------------|
| NVIDIA API | AI-powered scene analysis, threat detection | REST API (HTTP POST to `integrate.api.nvidia.com/v1/chat/completions`) |
| go2rtc (alexxit/go2rtc:1.9.14) | RTSP to WebRTC bridge for browser streaming | External Docker container, HTTP API + WebRTC |
| YOLO models (YOLOv8m/v5n/v4-tiny) | Object detection via OpenCV DNN | Local ONNX model files in `opencv-service/models/` |
| InsightFace (ArcFace) | Face recognition | Python library with pretrained models |
| OpenCV MOG2 | Motion detection (background subtraction) | Built-in OpenCV algorithm |
| FFmpeg | RTSP stream ingestion (subprocess) | System binary + `ffmpeg-static` bundled fallback |

## Camera Integration

| Aspect | Details |
|--------|---------|
| Protocol | RTSP (TCP transport) |
| Configuration | `server/cameras.json` (gitignored), `server/cameras.example.json` (template) |
| Credential encryption | AES-256-GCM via `CREDENTIAL_ENCRYPTION_KEY` env var (`server/src/services/credentialEncryption.ts`) |
| Stream path | go2rtc → Python pipeline (reads from go2rtc internal RTSP proxy at `rtsp://go2rtc:8554`) |
| Resolution | Default detect: 640×360 @ 5 FPS, Live: 1280×720 |
| Max cameras | 50 (configurable) |
| Max concurrent streams | 20 |

## Detection Pipeline Integration Flow

```
RTSP Camera
    │
    ▼
go2rtc (port 8555) ─── WebRTC ─── Browser
    │
    ▼ (rtsp://go2rtc:8554)
Python Service (port 8084 + 9090)
    ├── FFmpeg subprocess → raw BGR24 frames
    ├── MOG2 motion gate
    ├── YOLOv8n/v5n/v4-tiny object detection
    ├── ByteTracker (Kalman multi-object tracking)
    ├── InsightFace ArcFace (face recognition)
    └── WebSocket Publisher → ws://localhost:9090
         │
         ▼
Node.js Backend (port 9753)
    ├── PythonWsClient receives tracking events
    ├── Persists events to PostgreSQL
    ├── Relays frames via Socket.io to browser
    └── NVIDIA API for scene analysis (optional)
         │
         ▼
Browser Clients (Socket.io)
```

## Environment Configuration

**Critical env vars (required for operation):**
- `POSTGRES_PASSWORD` — Database password
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — JWT signing secrets
- `CREDENTIAL_ENCRYPTION_KEY` — AES-256-GCM key for RTSP credential encryption

**Optional but important:**
- `NVIDIA_API_KEY` — For AI scene analysis
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web push notifications (auto-generated if absent)
- `SMTP_*` — Email configuration (config in `.env.example`, not actively used in scanned code)
- `OPENC_V_SERVICE_URL` — Defaults to `http://opencv:8084` in Docker, `http://localhost:8084` in dev
- `CORS_ORIGIN` — Production CORS origin (default: `https://argus.tayenjam.qzz.io`)

---

*Integration audit: 2026-07-16*
