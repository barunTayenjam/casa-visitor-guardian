# SentryVision External Integrations

## Overview

SentryVision integrates with multiple external services and systems to provide comprehensive home security functionality including real-time video streaming, motion detection, facial recognition, and notifications.

## Database Integrations

### PostgreSQL Database
**Purpose:** Primary persistent storage

**Connection Details:**
- Host: `postgres` (Docker service name)
- Port: 5432
- Database: `sentryvision`
- User: `sentryvision`
- Connection pooling: TypeORM
- Migrations: 14 migration files in `database/migrations/`

**Data Stored:**
- User accounts and authentication
- Security events (1,050+ events)
- Visitor records and timeline
- Detection cache and results
- Batch processing jobs
- Review segments
- Notification preferences
- Storage statistics

**Access Methods:**
- TypeORM (backend) - ORM layer with entities
- pg client (database migrations) - Direct SQL
- psycopg2 (OpenCV service) - Python PostgreSQL adapter

**Schema Tables (17 total):**
```
users, roles, user_sessions, password_history, audit_logs
events, detection_config, processed_images, adaptive_regions
visitor_timeline, timeline
review_segments, user_review_status, batch_jobs
retention_policies, storage_stats, system_settings
```

**Health Check:**
- `pg_isready -U sentryvision -d sentryvision`
- Interval: 10s, timeout: 5s, retries: 5

### Redis Cache
**Purpose:** Caching, session storage, pub/sub

**Connection Details:**
- Host: `redis` (Docker service name)
- Port: 6379
- Client: `redis` npm package (v5.10.0)
- Memory limit: 50MB (configurable)
- Eviction policy: allkeys-lru

**Use Cases:**
- Detection result caching (1-hour TTL)
- User session storage
- Rate limiting counters
- Pub/sub for real-time updates
- Temporary detection data

**Health Check:**
- `redis-cli ping`
- Interval: 10s, timeout: 5s, retries: 5

## RTSP Camera Feeds

### IP Cameras
**Purpose:** Real-time video streaming for motion detection

**Camera Configuration:** `server/cameras.json`

**Active Cameras:**

1. **Front Door (cam1)**
   - RTSP URL: `rtsp://192.168.31.62:554/stream1`
   - Resolution: 1920x1080 @ 4 FPS (stream), 1280x720 @ 5 FPS (detection)
   - Tracked objects: person, car, dog, cat, package
   - Detection zones: Front Steps, Driveway, Street

2. **Back Door (cam2)**
   - RTSP URL: `rtsp://192.168.31.61:554/stream1`
   - Resolution: 1920x1080 @ 4 FPS (stream), 1280x720 @ 5 FPS (detection)
   - Tracked objects: person, car, dog, cat
   - Detection zones: Back Patio, Gate

**Stream Processing:**
- FFmpeg for RTSP stream decoding
- Motion detection via OpenCV service
- Frame extraction at 2-4 FPS
- Adaptive day/night sensitivity (22:00-06:00 IST)

**Protocol:** RTSP over TCP

## Internal Service Communication

### OpenCV Service Integration
**Purpose:** Computer vision processing (motion detection, face recognition)

**Service Details:**
- Framework: Flask (Python)
- Port: 8084
- Container: `sentryvision-opencv`
- Client: axios (backend)

**Endpoints:**
- `POST /detect` - Motion detection on frame
- `POST /detect-objects` - YOLO object detection
- `POST /recognize-faces` - Face recognition with embeddings
- `POST /compare-face` - Face comparison
- `GET /health` - Health check

**Communication Flow:**
```
Backend → HTTP POST → OpenCV Service
├─ Sends: JPEG frame bytes, config
└─ Receives: Detection results (JSON)
```

**Data Transfer:**
- Format: JPEG images (base64 or binary)
- Max frame size: ~100KB compressed
- Processing time: 15-20ms per frame

**Error Handling:**
- Retry logic with exponential backoff
- Timeout: 30 seconds
- Fallback: Basic motion detection if service unavailable

### Socket.io Integration
**Purpose:** Real-time bidirectional communication

**Server:** Socket.io 4.7.2 (Backend on port 9753)
**Client:** Socket.io Client 4.8.1 (Frontend)

**Events:**
- `requestStream` - Client requests camera stream
- `stopStream` - Client stops camera stream
- `frame` - Server sends video frame
- `motionDetected` - Motion event notification
- `objectDetected` - Object detection results
- `faceDetected` - Face recognition results
- `alert` - Security alerts
- `disconnect` - Connection cleanup

**Rooms/Namespace:**
- Camera-specific rooms: `cam1`, `cam2`
- User-specific notifications

**Connection Handling:**
- Automatic reconnection
- Heartbeat monitoring
- Cleanup on disconnect

**Stream URL:** `ws://localhost:9753/socket.io/`

## Authentication Services

### JWT (JSON Web Tokens)
**Purpose:** Stateless authentication

**Implementation:**
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry
- Storage: HttpOnly cookies
- Algorithm: HS256

**Token Endpoints:**
- `POST /api/auth/login` - Issue tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate tokens

**Middleware:**
- JWT verification on protected routes
- Token rotation on refresh
- Revocation via user_sessions table

### TOTP MFA (Multi-Factor Authentication)
**Purpose:** Two-factor authentication

**Implementation:**
- Library: speakeasy (2.0.0)
- Algorithm: SHA1
- Digits: 6
- Period: 30 seconds
- Compatible: Google Authenticator, Authy

**Endpoints:**
- `GET /api/auth/mfa/setup` - Generate secret + QR code
- `POST /api/auth/mfa/verify` - Verify TOTP code
- `POST /api/auth/mfa/disable` - Disable MFA

**QR Code Generation:**
- Library: qrcode (1.5.4)
- Format: PNG base64
- URL: `otpauth://totp/...`

## Notification Services

### Email Notifications (nodemailer)
**Purpose:** Security alert emails

**Configuration:**
- Library: nodemailer 7.0.11
- Transport: SMTP (configurable via env)
- Templates: HTML email templates

**Use Cases:**
- Motion detection alerts
- Unknown face detected
- System alerts (e.g., camera offline)
- User activity (login, MFA changes)

**Environment Variables:**
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@sentryvision.com
SMTP_PASS=password
```

### Web Push Notifications
**Purpose:** Browser push notifications

**Implementation:**
- Library: web-push 3.6.7
- VAPID keys for authentication
- Service Worker: Frontend registration

**Endpoints:**
- `POST /api/notifications/subscribe` - Subscribe to push
- `POST /api/notifications/unsubscribe` - Unsubscribe
- `POST /api/notifications/send` - Send push notification

**Payload:**
- Title, body, icon
- Action buttons
- TTL: 24 hours

## File System Integrations

### Detection Images Storage
**Path:** `./data/detections/`

**Purpose:** Store captured motion/event images

**Structure:**
```
data/detections/
├── cam1/
│   ├── 2026-03-23/
│   │   ├── event_1_uuid.jpg
│   │   └── event_2_uuid.jpg
└── cam2/
    └── ...
```

**Access:**
- Backend: Sharp for image processing
- Frontend: Serve via `/api/events/image/:filename`
- OpenCV: Direct file write access

### Snapshots Storage
**Path:** `./data/snapshots/`

**Purpose:** Manual camera snapshots

**Access:**
- `POST /api/cameras/:id/snapshot` - Capture snapshot
- `GET /api/snapshots/:filename` - Retrieve snapshot

### Events Storage
**Path:** `./data/events/`

**Purpose:** Event metadata and thumbnails

**Access:**
- TypeORM entity: `Event` model
- Image path references in database

## Third-Party Libraries (as Integrations)

### OpenCV (opencv-contrib-python-headless)
**Purpose:** Computer vision operations

**Version:** 4.8.0+
**Features Used:**
- Background subtraction (MOG2)
- Contour detection
- Morphological operations
- Image processing (resize, blur, threshold)

**License:** Apache 2.0

### dlib (via face-recognition)
**Purpose:** Face detection and recognition

**Features Used:**
- HOG face detector
- CNN face detector (optional)
- Face embeddings (128-d vector)
- Face comparison (euclidean distance)

**Model:** Pre-trained face recognition model

### FFmpeg (ffmpeg-static)
**Purpose:** Video stream processing

**Version:** 5.3.0
**Features Used:**
- RTSP stream decoding
- Frame extraction
- Video encoding (FLV for streaming)
- Codec: H.264

**Integration:**
- Spawn child process in Node.js
- Pipe frames to OpenCV service
- Convert to JPEG for HTTP transmission

## External APIs (Future)

### Weather API (Planned)
**Purpose:** Adjust detection sensitivity based on weather

**Considerations:**
- OpenWeatherMap API
- Local weather conditions
- Impact on motion detection (rain, snow, fog)

### Geolocation API (Planned)
**Purpose:** Location-based automation

**Use Cases:**
- Arm/disarm based on user location
- Push notifications when away
- Geofencing for cameras

## Security Considerations

### Secrets Management
**Current:** Environment variables in `.env` files
**Recommendation:** Use Docker secrets or vault

**Sensitive Data:**
- JWT secrets (access, refresh)
- Database passwords
- RTSP credentials (embedded in URLs)
- SMTP credentials
- VAPID keys (push notifications)

### API Security
**Implemented:**
- CORS configuration
- Helmet.js security headers
- Rate limiting (100 req/15min)
- Input validation (Zod)
- SQL injection prevention (TypeORM)

**RTSP Security:**
- Credentials in `cameras.json`
- Plaintext transmission (local network only)
- Recommendation: Use HTTPS proxy for remote access

### Data Privacy
**Compliance:**
- Face embeddings stored in database
- User can delete faces/visitors
- Audit logging for sensitive operations
- Data retention policies

## Monitoring & Observability

### Health Checks
**Endpoints:**
- `GET /api/health` - Backend health
- `GET http://opencv:8084/health` - OpenCV service
- Docker health checks for all containers

**Metrics:**
- Storage usage (`storage_stats` table)
- Event counts
- System performance (CPU, memory)

### Logging
**Backend:**
- Debug library with namespaces
- Console output (Docker logs)
- Log levels: error, warn, info, debug

**Frontend:**
- Browser console
- Network tab in DevTools

**Database:**
- Audit logs table for security events
- PostgreSQL query logs (development)

## Deployment Integration

### Docker
**Orchestration:** Docker Compose

**Services:**
- sentryvision-frontend
- sentryvision-backend
- sentryvision-postgres
- sentryvision-redis
- sentryvision-opencv

**Networking:**
- Bridge network: `sentryvision_network`
- Internal DNS for service discovery

**Volumes:**
- postgres_data (persistent)
- redis_data (persistent)
- Bind mounts for development

### Resource Limits
**Backend:** 1 CPU core, 1GB RAM
**Frontend:** 0.5 CPU core, 512MB RAM
**PostgreSQL:** 0.25 CPU core, 384MB RAM
**Redis:** 0.1 CPU core, 64MB RAM
**OpenCV:** 0.5 CPU core, 512MB RAM

**Total:** ~2.4 cores, ~2.5GB RAM (optimized for 2GB systems)

## Network Configuration

### Port Exposure
**Public (External Access):**
- 5173 → Frontend (dev only)
- 9753 → Backend API (dev only)

**Internal (Docker Network):**
- 5432 → PostgreSQL
- 6379 → Redis
- 8084 → OpenCV

### Proxy Configuration
**Frontend Dev Server (Vite):**
- `/api/*` → Backend (9753)
- `/socket.io` → WebSocket (9753)
- Rewrites for clean URLs

## API Integration Patterns

### REST APIs
**Backend → Frontend:**
- React Query for data fetching
- Automatic caching and revalidation
- Optimistic updates

**Backend → OpenCV:**
- Axios HTTP client
- POST with multipart/form-data
- Binary image upload

### WebSocket APIs
**Bidirectional:**
- Socket.io on top of WebSocket
- Event-based messaging
- Room-based subscriptions

### Database Access
**TypeORM Pattern:**
- Repository pattern
- Query builders
- Relations (eager/lazy loading)
- Transactions (critical operations)

## Future Integrations

### Home Automation
- MQTT for smart home devices
- Home Assistant integration
- IFTTT webhooks

### Cloud Storage
- AWS S3 for long-term video storage
- Google Cloud Storage
- Azure Blob Storage

### Analytics
- Google Analytics (frontend)
- Sentry (error tracking)
- DataDog (monitoring)

### AI/ML Services
- Cloud vision APIs (backup to OpenCV)
- Custom ML model deployment
- Edge AI optimization
