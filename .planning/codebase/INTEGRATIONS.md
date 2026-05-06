# External Integrations

**Analysis Date:** 2026-05-05

## RTSP Camera Streams

**Camera Hardware:**
- RTSP IP cameras (currently 2 cameras: Front Door, Back Door)
- Resolution: 1920x1080 @ 4 FPS (stream), 640x360 @ 3 FPS (detection)

**Integration Method:**
- FFmpeg spawned as child process in backend
- `server/src/streams/rtspManager.ts` - Manages RTSP stream lifecycle
- Configuration: `server/cameras.json` - Camera URLs, zones, detection parameters

**FFmpeg Path:**
- Primary: System FFmpeg (preferred for Docker/Alpine)
- Fallback: `ffmpeg-static` bundled binary

**Credentials:**
- Encrypted stream paths via `credentialEncryption.ts`
- Support for both plaintext and encrypted formats
- Security event logging for plaintext detection

## AI Detection Service

**OpenCV Python Service:**
- Location: `/opencv-service/` - Flask application
- Port: 8084
- HTTP API from backend

**Detection Capabilities:**
- Motion detection using MOG2 background subtraction
- Object detection using YOLO (YOLO model loaded at startup)
- Face recognition via face_recognition library
- Person, car, dog, cat, package detection

**Backend Integration:**
- `server/src/detection/optimizedMotionDetection.ts` - Primary detection logic
- `server/src/detection/motionTriggeredDetection.ts` - Object/face triggered detection
- HTTP requests to `http://opencv:8084` endpoints
- Cache layer using PostgreSQL and Redis

**Motion Detection Parameters (Optimized):**
- history: 200 (faster adaptation)
- varThreshold: 8 (2x more sensitive)
- detectShadows: false
- motion_threshold: 0.002 (0.2% frame area)
- Processing: 15-20ms per frame

## Database

**PostgreSQL:**
- Version: 15+
- Host: postgres container (port 5432)
- Database: sentryvision
- User: sentryvision
- Connection: Environment variables via Docker Compose

**TypeORM:**
- Entity models in `server/src/models/`
- Migrations in `database/migrations/`
- Connection pooling configured

**Redis:**
- Version: 7-alpine
- Port: 6379
- Used for: Session caching, detection result caching
- Max memory: 50MB (configurable)
- Eviction policy: allkeys-lru

## Authentication

**JWT-Based Authentication:**
- Access token: 15-24 hours (configurable)
- Refresh token: 7 days
- Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- Implementation: `server/src/utils/jwtService.ts`

**TOTP MFA:**
- Library: speakeasy
- Backend: Google Authenticator compatible
- Setup endpoint: `GET /api/auth/mfa/setup`
- Verification endpoint: `POST /api/auth/mfa/verify`
- Implementation: `server/src/services/totpService.ts`

**Password Security:**
- bcrypt hashing (12 rounds default)
- Password history tracking
- Lockout after failed attempts

**Sessions:**
- Track user sessions in database
- Token blacklist support
- Redis caching for active sessions

## Real-Time Communication

**Socket.io:**
- Bidirectional communication between backend and frontend
- Events:
  - `requestStream` - Request camera stream
  - `stopStream` - Stop stream
  - `frame` - Streamed frame data
  - `motionDetected` - Motion event notification
  - `visitorDetected` - Face recognition results

**Frontend Integration:**
- `socket.io-client` 4.x
- Context provider: `SocketContext.tsx`
- Auto-reconnection enabled

## Rate Limiting

**Implementation:** express-rate-limit

**Default Configuration:**
- Standard: 100 requests / 15 minutes
- Detection: 10 requests / 1 minute
- Batch: 5 requests / 1 hour

## Web Push Notifications

**Service:** web-push (Push API)

**Frontend:**
- Implemented for browser notifications

**Use Cases:**
- Motion detection alerts
- Visitor detection alerts

## Image Processing

**Sharp:**
- Image resizing and optimization
- Used for snapshots and thumbnails

## Container Networking

**Docker Compose Network:**
- Network: sentryvision_network (bridge driver)
- Service-to-service communication via DNS

**Port Configuration:**
- Frontend: 5173
- Backend: 9753
- OpenCV: 8084
- PostgreSQL: 5432
- Redis: 6379

## Environment Configuration

**Required Environment Variables:**

Backend (.env):
- `NODE_ENV` - Environment mode
- `PORT` - Server port (9753)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` - Auth secrets
- `OPENCV_SERVICE_URL` - OpenCV service URL
- `DETECTIONS_DIR` - Detection storage directory

Frontend:
- `VITE_BACKEND_URL` - Backend API URL

OpenCV Service:
- `PORT` - Service port (8084)
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`

## Webhooks & Callbacks

**Outgoing:**
- Motion detection triggers database event creation
- Face detection triggers visitor timeline update

**Incoming:**
- Batch detection requests from frontend
- Re-detection on existing events

---

*Integration audit: 2026-05-05*