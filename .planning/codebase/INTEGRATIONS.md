# External Integrations

**Analysis Date:** 2026-05-06

## APIs & External Services

**NVIDIA AI Vision API:**
- Service: NVIDIA NIM (build.nvidia.com) — Vision LLM for image analysis
- SDK/Client: Native `fetch` to `https://integrate.api.nvidia.com/v1/chat/completions`
- Auth: `NVIDIA_API_KEY` env var
- Models: `nvidia/llama-3.1-nemotron-nano-vl-8b-v1` (default), configurable via `NVIDIA_MODEL`
- Capabilities: Object detection with bounding boxes, person analysis, scene description
- Implementation: `server/src/services/nvidiaAnalysisService.ts`, `server/src/routes/nvidiaRoutes.ts`
- Fallback: Falls back to OpenCV service when NVIDIA API fails
- Status: Optional — degrades gracefully when API key not configured

**OpenCV Detection Service (Internal microservice):**
- Service: Python Flask app running on port 8084
- SDK/Client: `axios` HTTP client via `server/src/services/opencvMicroserviceClient.ts`
- Auth: None (internal network only, Docker `sentryvision_network`)
- Endpoints used: `/detect`, `/detect-faces`, `/health`, `/motion-detect`
- Protocol: HTTP REST with JSON payloads
- Features: YOLO object detection, face recognition, motion detection (MOG2), Redis-cached results
- Implementation: `opencv-service/app.py` (1903 lines), `opencv-service/improved_face_recognition.py`

## Data Storage

**Databases:**
- PostgreSQL 15 (Alpine Docker image)
  - Connection: `postgresql://sentryvision:sentryvision123@postgres:5432/sentryvision`
  - Env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - ORM: TypeORM with entity files in `server/src/models/` (32 model files)
  - Direct SQL: Also used via `AppDataSource.query()` for complex queries
  - Python access: `psycopg2` with connection pooling in `opencv-service/app.py`
  - Migrations: 26 SQL files in `database/migrations/` (001–017 with sub-variants)
  - Tables: 17+ tables (users, events, visitors, batch_jobs, review_segments, face_embeddings, etc.)
  - Docker volume: `postgres_data` for persistent storage

**File Storage:**
- Local filesystem with structured directories
  - Base path: `data/detections/` (configurable via `DETECTIONS_DIR`)
  - Layout: `data/detections/{YYYY-MM}/events/{faces,motion}/` — monthly partitioning
  - Snapshots: `data/snapshots/`
  - Events: `data/events/` and `public/events/`
  - Detection files tracked in `detection_files` database table with `storage_path`, `original_filename`, `file_type`
  - Archive path: `data/detections/archive/{YYYY-MM}/`
  - Config: `server/src/config/index.ts` → `storage` section

**Caching:**
- Redis 7 (Alpine Docker image)
  - Connection: `redis://redis:6379` (Docker) or `redis://localhost:6379` (local)
  - Env vars: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - Max memory: 50MB (configurable via `REDIS_MAX_MEMORY`)
  - Eviction: `allkeys-lru` policy
  - Used for: Detection result caching, session data, rate limit counters
  - Clients: `redis` npm package (Node.js), `redis` pip package (Python)
  - Graceful degradation: Falls back to in-memory Map cache when Redis unavailable
  - Can be disabled entirely: Set `REDIS_DISABLED=true`
  - Docker volume: `redis_data`
  - Implementation:
    - `server/src/services/cacheService.ts` — Primary cache service with Redis/memory fallback
    - `server/src/services/redisCache.ts` — Alternative Redis client using `ioredis`
    - `server/src/detection/consolidatedDetectionService.ts` — Detection result caching

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `server/src/auth/index.ts`, `server/src/services/authenticationService.ts`
  - Token strategy: Access tokens (15 min default) + Refresh tokens (7 days)
  - Hashing: `bcrypt` (native) with 12 rounds (configurable via `BCRYPT_ROUNDS`)
  - JWT library: `jsonwebtoken` npm package
  - Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` env vars
  - Session tracking: `user_sessions` table + `UserSession` TypeORM model
  - Middleware: `server/src/middleware/auth.ts` — `requireUser`, `requireAdmin`, `optionalAuth`

**MFA (Multi-Factor Authentication):**
- TOTP-based (Google Authenticator compatible)
  - Library: `speakeasy` npm package
  - Implementation: `server/src/services/totpService.ts`
  - Setup endpoint: `GET /api/auth/mfa/setup` — generates QR code via `qrcode` package
  - Verify endpoint: `POST /api/auth/mfa/verify`
  - Features: Backup codes, rate limiting on verification attempts

**Web Push Notifications:**
- VAPID protocol via `web-push` npm package
  - Implementation: `server/src/services/notificationService.ts`
  - Keys: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars
  - Subscription storage: `NotificationSubscription` TypeORM entity → `notification_subscriptions` table
  - Log storage: `NotificationLog` entity → `notification_logs` table
  - Preferences: `NotificationPreferences` entity → `notification_preferences` table
  - Status: Initialized but VAPID keys must be configured for push to work

**Credential Encryption:**
- AES-256 encryption for stored RTSP credentials
  - Implementation: `server/src/services/credentialEncryption.ts`
  - Key: `CREDENTIAL_ENCRYPTION_KEY` env var (32-byte minimum)
  - Applied to: Camera RTSP stream paths in `cameras.json`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, DataDog, or similar integrated)
- Placeholder config exists in `.env.example` for Datadog (`DATADOG_ENABLED`, `DATADOG_API_KEY`) and New Relic (`NEW_RELIC_ENABLED`, `NEW_RELIC_LICENSE_KEY`)

**Logs:**
- Custom logger: `server/src/utils/logger.ts`
- Console-based logging with severity levels
- Audit logging: `server/src/utils/auditLogger.ts` → `audit_logs` database table
- Security event logging: `server/src/models/SecurityEvent.ts` → `security_events` table
- Log files: Configured via `LOG_LEVEL`, `LOG_FILE` env vars (`.env.example`)

**Health Checks:**
- Backend: `GET /api/health` — Docker healthcheck every 30s
- OpenCV: `GET /health` — Docker healthcheck every 30s
- PostgreSQL: `pg_isready` — Docker healthcheck every 10s
- Redis: `redis-cli ping` — Docker healthcheck every 10s

## CI/CD & Deployment

**Hosting:**
- Self-hosted on Linux (Manjaro) — Docker Compose based deployment
- systemd service: `sentryvision.service` for auto-start on boot
- Deployment script: `deploy-to-manjaro.sh`
- OpenCV deploy: `deploy-opencv-docker.sh`

**CI Pipeline:**
- None (no GitHub Actions, GitLab CI, or similar configured)
- Testing is manual via `npm run test`, `npm run lint`, `npm run typecheck`

**Reverse Proxy:**
- Nginx (`nginx.conf`) — configured for production deployment
  - Proxies `/api/` and `/socket.io/` to backend
  - Serves frontend static files with SPA routing
  - Gzip compression enabled
  - Security headers (X-Frame-Options, CSP, etc.)

## Environment Configuration

**Required env vars (backend):**
- `PORT` — Server port (default: 9753)
- `NODE_ENV` — Environment mode (development/production)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — PostgreSQL connection
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — JWT signing keys
- `CREDENTIAL_ENCRYPTION_KEY` — Camera credential encryption key
- `OPENCV_SERVICE_URL` — OpenCV Flask service URL (default: `http://opencv:8084`)

**Optional env vars (features):**
- `NVIDIA_API_KEY`, `NVIDIA_MODEL` — AI vision analysis
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — Redis caching (falls back to memory)
- `REDIS_DISABLED` — Set to `true` to skip Redis entirely
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web push notifications
- `MQTT_ENABLED`, `MQTT_HOST`, `MQTT_PORT` — IoT integration
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Email notifications (placeholder)
- `VITE_BACKEND_URL` — Frontend backend URL (default: `http://localhost:9753`)

**Secrets location:**
- `.env` file at project root (gitignored)
- `server/.env` (gitignored)
- Docker Compose environment sections (contains development defaults)
- `server/cameras.json` — Contains RTSP URLs with embedded credentials

## Webhooks & Callbacks

**Incoming:**
- None configured

**Outgoing:**
- MQTT Publishing (optional) — Publishes security events to MQTT broker
  - Implementation: `server/src/services/mqttService.ts`
  - Config: `MQTT_ENABLED`, `MQTT_HOST`, `MQTT_PORT`, `MQTT_TOPIC_PREFIX`
  - Default topic prefix: `sentryvision`
  - Status: Implemented but disabled by default
- Web Push — Outbound push notifications to browser clients via VAPID
  - Implementation: `server/src/services/notificationService.ts`
- Webhook placeholders (configured in `.env.example` but not implemented):
  - `SLACK_WEBHOOK`, `DISCORD_WEBHOOK` — Alert webhooks
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram notifications
  - `WEBHOOK_URL` — Generic webhook endpoint

## RTSP Camera Integration

**Camera Connectivity:**
- Protocol: RTSP over TCP
- Cameras: 2 IP cameras on local network (192.168.31.61, 192.168.31.62)
- Stream processing: FFmpeg (bundled via `ffmpeg-static`) decodes RTSP → JPEG frames
- Configuration: `server/cameras.json` — per-camera RTSP URLs, resolution, FPS, zones
- Stream management: `server/src/streams/rtspManager.ts` — orchestrates stream lifecycle
- Frame delivery: Socket.IO streams MJPEG frames to frontend clients
- Credentials: Embedded in RTSP URLs or encrypted via credential encryption service

---

*Integration audit: 2026-05-06*
