# External Integrations

**Analysis Date:** 2026-05-15

## APIs & External Services

**NVIDIA AI Vision API:**
- Purpose: AI-powered scene analysis, person detection with bounding boxes, threat assessment
- SDK/Client: Native `fetch()` calls to `https://integrate.api.nvidia.com/v1/chat/completions`
- Auth: `NVIDIA_API_KEY` env var (Bearer token in Authorization header)
- Implementation: `server/src/services/nvidiaAnalysisService.ts` (963 lines)
- Routes: `server/src/routes/nvidiaRoutes.ts` — `POST /api/nvidia/analyze`, `POST /api/nvidia/analyze-bbox`, `POST /api/nvidia/analyze-persons`
- Models used: Configurable, vision LLM chat completions
- Status: Optional — requires API key to be set; gracefully disabled when key is absent

**RTSP Camera Streams:**
- Purpose: Live video from IP cameras (currently 2 cameras)
- Protocol: RTSP over TCP, processed via FFmpeg
- Configuration: `server/cameras.json` — per-camera RTSP URLs, resolution, FPS, zones, object filters
- Client: `ffmpeg-static` or system `ffmpeg` (auto-detected at startup)
- Implementation: `server/src/streams/rtspManager.ts` — manages FFmpeg child processes per camera
- Stream roles: `detect` (low-res for CV), `live` (socket.io frames), `record` (future)
- Cameras:
  - cam1 "Front Door" — 1920x1080 @ 2 FPS (live), 1280x720 @ 5 FPS (detect)
  - cam2 "Back Door" — 1920x1080 @ 2 FPS (live), 1280x720 @ 5 FPS (detect)

**OpenCV Python Microservice:**
- Purpose: Object detection (YOLO), face recognition, motion detection, detection caching
- URL: `http://opencv:8084` (Docker) / `http://localhost:8084` (local)
- Client: `server/src/services/opencvMicroserviceClient.ts` — Axios-based with circuit breaker pattern
- Endpoints: `/health`, `/detect`, `/detect-face`, `/recognize-face`, `/motion-detect`, `/cache/stats`
- Health monitoring: 30-second health checks with automatic circuit breaker

## Data Storage

**Databases:**
- PostgreSQL 15 (Alpine)
  - Host: `DB_HOST` env var (default: `postgres` in Docker, `172.26.0.3` local)
  - Port: `DB_PORT` (5432)
  - Database: `sentryvision`
  - Client: TypeORM (`server/src/database.ts`) + direct SQL via `pg` driver
  - ORM entities: `server/src/models/*.ts` (28 model files)
  - Migrations: `database/migrations/` (26 SQL files, 001–017)
  - Connection pool: TypeORM managed, configurable via `DB_POOL_*` env vars
- OpenCV service also has direct PostgreSQL access via `psycopg2` for detection cache (`detection_cache` table)

**File Storage:**
- Local filesystem only — organized by year-month directories
- Detection images: `data/detections/YYYY-MM/events/{faces,motion}/`
- Snapshots: `data/detections/YYYY-MM/snapshots/`
- Batch results: `data/detections/YYYY-MM/batch-results/`
- Archive: `data/detections/archive/YYYY-MM/`
- Configuration: `server/src/config/index.ts` — `getDetectionsPath()`, `getEventPath()`, `getArchivePath()`
- Storage stats tracked in `storage_stats` table via `server/src/services/storageStatsService.ts`

**Caching:**
- Redis 7 (Alpine)
  - Host: `REDIS_HOST` (default: `redis` in Docker)
  - Port: `REDIS_PORT` (6379)
  - Max memory: 40MB with `allkeys-lru` eviction
  - Client: `ioredis` via `server/src/services/redisCache.ts` — typed get/set/del/keys with TTL
  - Also used by OpenCV service directly (`redis` Python package)
  - Fallback: `server/src/services/cacheService.ts` — in-memory cache when Redis unavailable

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based implementation
  - Implementation: `server/src/auth/index.ts` — `AuthService` class
  - Token format: JWT with `{userId, username, role}` payload
  - Access token: `JWT_ACCESS_SECRET` env var, configurable expiry (`JWT_EXPIRES_IN`, default 24h)
  - Refresh token: `JWT_REFRESH_SECRET` env var
  - Password hashing: bcrypt with 12 rounds
  - MFA: TOTP-based via `speakeasy` — QR code generation via `qrcode` package
  - Seed users: Default `admin/admin123` and `user/user123` seeded in development mode
  - Middleware: `server/src/middleware/auth.ts` — `authenticate()` with optional role checking

**Authorization Roles:**
- `admin` — Full access, all permissions (`['*']`)
- `user` — Limited access (`['read:own', 'write:own']`)
- `viewer` — Read-only (defined in `roles` table)
- Enforced via `authenticate({ roles: ['admin'] })` middleware on routes

**Credential Encryption:**
- RTSP camera credentials encrypted at rest
- Implementation: `server/src/services/credentialEncryption.ts` — AES-256-GCM with PBKDF2 key derivation
- Key: `CREDENTIAL_ENCRYPTION_KEY` env var (min 32 characters)

## Monitoring & Observability

**Error Tracking:**
- Custom security event logging to `security_events` table
- Implementation: `server/src/models/SecurityEvent.ts` — tracks events like `CREDENTIAL_DECRYPTION_FAILED`, `PLAINTEXT_CREDENTIALS_DETECTED`
- No external error tracking service (no Sentry, etc.)

**Logs:**
- Custom logger: `server/src/utils/logger.ts` — structured logging with context
- Console-based (stdout/stderr) — captured by Docker logs
- Health monitor script runs alongside backend: `sh /app/health-monitor.sh` in Docker
- Stream health: `server/src/streams/streamHealthMonitor.ts` — monitors camera stream stability

**Health Checks:**
- Backend: `GET /api/health` — returns service status
- OpenCV: `GET /health` — returns model initialization status
- PostgreSQL: `pg_isready` in Docker healthcheck
- Redis: `redis-cli ping` in Docker healthcheck

## CI/CD & Deployment

**Hosting:**
- Self-hosted on local Linux machine (Manjaro)
- Docker Compose for service orchestration
- systemd service for auto-start on boot (`sentryvision.service`)

**CI Pipeline:**
- None — no CI/CD platform configured (no GitHub Actions, Jenkins, etc.)
- Manual deployment via shell scripts (`deploy-to-manjaro.sh`, `start-all-services.sh`)

**Reverse Proxy:**
- nginx (`nginx.conf`) — for production static file serving + API proxy
- Vite dev proxy — for development mode API forwarding

## Environment Configuration

**Required env vars (active — actually consumed by code):**
- `PORT` — Backend API port (default: 9753)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — PostgreSQL connection
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — JWT signing
- `CREDENTIAL_ENCRYPTION_KEY` — RTSP credential encryption
- `OPENCV_SERVICE_URL` — OpenCV microservice URL
- `DETECTIONS_DIR` — File storage root for detections
- `LOW_RESOURCE_MODE` — Enable resource-constrained optimizations
- `VITE_BACKEND_URL` — Frontend → Backend URL (dev proxy target)
- `TZ` — Timezone (Asia/Kolkata)
- `REDIS_HOST`, `REDIS_PORT` — Redis connection

**Optional env vars (configured but feature may be inactive):**
- `NVIDIA_API_KEY` — AI vision analysis
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web Push notifications
- `MQTT_*` — MQTT integration (config defined in `server/src/config/index.ts` but no MQTT client package installed)
- `SMTP_*` — Email sending (nodemailer installed but not actively used in routes)

**Secrets location:**
- `.env` file at project root — contains all secrets (gitignored)
- `.env.example` — template with placeholder values
- `.env.production` — production overrides
- `docker-compose.yml` — contains default dev credentials (acceptable for dev-only)

## Webhooks & Callbacks

**Incoming:**
- None — no webhook receiver endpoints

**Outgoing:**
- Web Push notifications via `web-push` library (`server/src/services/notificationService.ts`)
  - VAPID protocol for push subscription management
  - Per-user notification preferences stored in `notification_preferences` table
  - Quiet hours support
- Notification models: `server/src/models/NotificationSubscription.ts`, `NotificationLog.ts`, `NotificationPreferences.ts`
- Routes: `server/src/routes/notificationRoutes.ts`

## Real-time Communication

**Socket.io:**
- Server: `socket.io` on backend (port 9753)
- Client: `socket.io-client` on frontend
- Frontend service: `frontend/src/services/SocketService.ts`
- Frontend context: `frontend/src/contexts/SocketContext.tsx`
- Events:
  - `requestStream` / `stopStream` — Camera live view control
  - `frame` — Camera frame delivery (base64 JPEG)
  - `motionDetected` — Real-time motion alerts
- Connection: Auto-reconnect with visibility change handling

## Third-party Packages (Notable)

**Circuit Breaker:**
- Custom implementation: `server/src/services/circuitBreaker.ts` — used with OpenCV microservice calls
- States: CLOSED → OPEN → HALF_OPEN with configurable thresholds

**Image Processing:**
- `sharp` — Server-side image resize/convert (backend)
- OpenCV (`cv2`) — Motion detection, object detection, face detection (Python service)
- `ffmpeg-static` / system FFmpeg — RTSP stream decoding, frame extraction

**Scheduled Tasks:**
- `node-cron` — Automated cleanup, retention enforcement (`server/src/utils/cronJobs.ts`)
- `server/src/services/retentionPolicyService.ts` — Data retention management
- `server/src/services/automatedCleanupService.ts` — Automated detection file cleanup

---

*Integration audit: 2026-05-15*
