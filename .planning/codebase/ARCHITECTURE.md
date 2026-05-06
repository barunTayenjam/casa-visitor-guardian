# Architecture

**Analysis Date:** 2026-05-05

## Pattern Overview

**Overall:** Multi-tier microservices with event-driven architecture

**Key Characteristics:**
- React frontend with real-time Socket.io updates
- Express REST API with JWT authentication and TOTP MFA
- Python OpenCV service for computer vision processing
- PostgreSQL for persistence with TypeORM
- Redis for caching and session management

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                SentryVision Architecture                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   Frontend   │         │   Backend    │         │  OpenCV Svc  │         │   Database   │
  │   (React)    │◄───────►│  (Express)   │◄───────►│   (Flask)    │         │ (PostgreSQL) │
  │   Port 5173  │         │   Port 9753   │         │   Port 8084  │         │   Port 5432  │
  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘         └──────────────┘
         │                        │                        │                        │
         │    HTTP/REST +        │    HTTP +              │                        │
         │    Socket.io         │    Internal            │                        │
         ▼                        ▼                        ▼                        ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   Browser    │         │   Redis      │         │    OpenCV    │         │   Storage    │
  │   Client     │         │  (Cache/     │         │   (YOLO/     │         │  (Detections│
  │              │         │   Sessions)  │         │   MOG2/Face) │         │   Images)    │
  └──────────────┘         └──────────────┘         └──────────────┘         └──────────────┘
```

## Data Flow

### Motion Detection Flow

```
Camera RTSP Stream (cam1/cam2)
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  FFmpeg Process (rtspManager.ts)                                          │
│  - Convert RTSP to JPEG frames at 3-5 FPS                                 │
│  - Split into detect/live/record streams                                  │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  OptimizedMotionDetection (optimizedMotionDetection.ts)                   │
│  - MOG2 background subtraction (OpenCV Python service)                   │
│  - Adaptive sensitivity (90-100 day, 70-90 night)                        │
│  - Zone-based detection with coordinate filtering                         │
│  - Cooldown: 10 seconds, Detection interval: 3 seconds                   │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Event Creation (Event.ts model)                                          │
│  - Store: camera_id, timestamp, event_type, confidence, image_path      │
│  - Detection metadata: persons_detected, faces_detected, object_detections│
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
  │  Socket.io  │        │   Database  │        │  File Storage│
  │   Emit to   │        │   (Postgres) │        │  (images)   │
  │   Frontend  │        │              │        │             │
  └─────────────┘        └─────────────┘        └─────────────┘
```

### Face Recognition Flow

```
Detection Frame
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  HTTP POST to OpenCV Service (opencv-service/app.py)                     │
│  Endpoint: /api/detect/faces                                               │
│  - Face detection: ResNet SSD (res10_300x300_ssd_iter_140000_fp16.caffemodel)│
│  - Face recognition: 128D embeddings via improved_face_recognition.py      │
│  - Match against known_faces/ database                                    │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
  │   Visitor   │        │   Face      │        │   Socket.io │
  │  Timeline   │        │  Embeddings │        │   Emit      │
  │   Update    │        │   Store     │        │   FaceEvent │
  └─────────────┘        └─────────────┘        └─────────────┘
```

### Real-Time Streaming Architecture

```
                    ┌─────────────┐
                    │  RTSP       │
                    │  Camera     │
                    │ (cam1/cam2) │
                    └──────┬──────┘
                           │ RTSP stream
                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  StreamManager (rtspManager.ts)                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Single FFmpeg process per camera (shared across roles)                │ │
│  │ - detect: 640x360 @ 3 FPS (motion detection)                          │ │
│  │ - live: 1920x1080 @ 4 FPS (viewing)                                   │ │
│  │ - record: 1920x1080 @ 4 FPS (recording)                              │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Motion Detection│   │  Socket.io     │   │   Live Stream   │
│ Service         │   │  Broadcasting  │   │   MJPEG/HLS     │
│                 │   │                 │   │                 │
│ - MOG2 analysis │   │ - motionDetected│  │ - /stream/:id   │
│ - Event creation│   │ - frame update │   │ - /streams/:id/live│
└─────────────────┘   │ - personDetected│  └─────────────────┘
                     │ - faceDetected   │
                     └─────────────────┘
```

## Layers

### Frontend Layer (`frontend/src`)
- **Purpose:** React 18 UI with real-time updates
- **Location:** `/frontend/src`
- **Contains:**
  - Components: UI components, live streaming, events, dashboard
  - Pages: StreamDashboard, EventsPage, Settings, Analytics, Review
  - Services: ApiService (REST), SocketService (real-time)
  - Contexts: AuthContext, CameraContext, SocketContext, EventsContext
  - Hooks: useReview, useToast
- **Dependencies:** React Query (server state), React Router v6, Socket.io-client, Recharts

### Backend API Layer (`server/src`)
- **Purpose:** Express REST API with TypeScript
- **Location:** `/server/src`
- **Contains:**
  - Routes: index.ts (main 16K+ lines), auth.ts, visitorRoutes.ts, detectionRoutes.ts
  - Services: Business logic (detection, visitor, batch processing, timeline)
  - Models: TypeORM entities (Event, User, Visitor, BatchJob, ReviewSegment, etc.)
  - Detection: 3 implementations (optimizedMotionDetection, simpleMotionDetection, motionTriggeredDetection)
  - Streams: rtspManager.ts (FFmpeg orchestration), streamHealthMonitor.ts
  - Middleware: auth.ts, rateLimit.ts, validation.ts
- **Depends on:** PostgreSQL, Redis, OpenCV Service

### OpenCV Service Layer (`opencv-service`)
- **Purpose:** Python Flask computer vision service
- **Location:** `/opencv-service`
- **Contains:**
  - app.py: Main Flask application (1900+ lines)
  - improved_face_recognition.py: Face embedding generation
  - Models: YOLO (object detection), ResNet (face detection), face embeddings
- **Port:** 8084
- **Used by:** Backend detection services via HTTP

### Database Layer
- **Purpose:** PostgreSQL persistent storage
- **Location:** `/database` + `/server/src/models`
- **Contains:**
  - 17 tables: users, events, visitors, batch_jobs, review_segments, etc.
  - 8 migrations (001-008)
  - TypeORM models in `/server/src/models`

### Cache Layer
- **Purpose:** Redis for caching and sessions
- **Used by:** Backend services, OpenCV detection cache

## API Layer Structure

### Main API Routes (`server/src/routes/index.ts`)

**Authentication** (routes/auth.ts):
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/mfa/setup
- POST /api/auth/mfa/verify
- GET /api/auth/me

**Cameras**:
- GET /api/cameras - List all cameras
- GET /api/cameras/:id - Get camera details
- POST /api/cameras/:id/stream/start - Start streaming
- POST /api/cameras/:id/stream/stop - Stop streaming
- POST /api/cameras/:id/snapshot - Capture snapshot

**Events**:
- GET /api/events/list - Paginated event list
- GET /api/events/list-enhanced - Filtered events
- GET /api/events/:id/details - Event details
- GET /api/events/image/:filename - Serve event image

**Visitors**:
- GET /api/visitors/list - List visitors
- GET /api/visitors/timeline - Visitor timeline
- PUT /api/visitors/:id - Update visitor

**Detection**:
- POST /api/detection/redo - Re-run detection
- POST /api/detection/batch - Batch processing
- GET /api/detection/status/:jobId - Job status

**Review**:
- GET /api/review/segments - Review segments
- POST /api/review/segments/:id/dismiss - Dismiss segment
- POST /api/review/segments/:id/confirm - Confirm segment

**System**:
- GET /api/health - Health check
- GET /api/stats - System statistics
- GET /api/system/overview - Overview

## Real-Time Communication

### Socket.io Events

**Server → Client:**
- `motionDetected` - Motion event detected
- `personDetected` - Person detected in frame
- `faceDetected` - Face recognized
- `frame` - Live frame update
- `streamStatus` - Stream health status
- `alert` - Security alert

**Client → Server:**
- `requestStream` - Request camera stream
- `stopStream` - Stop camera stream
- `subscribe` - Subscribe to camera events

### Streaming Endpoints
- GET /stream/:cameraId - MJPEG stream
- GET /api/streams/:cameraId/live - Live HLS stream
- GET /api/streams/:cameraId/detect - Detection stream
- GET /api/streams/:cameraId/frame - Single frame

## Key Abstractions

### StreamManager (`server/src/streams/rtspManager.ts`)
- Purpose: Orchestrate RTSP camera streams with FFmpeg
- Pattern: Singleton with camera map
- Key methods: startStream(), stopStream(), getFrame()

### OptimizedMotionDetector (`server/src/detection/optimizedMotionDetection.ts`)
- Purpose: Main motion detection with adaptive sensitivity
- Pattern: Event-driven with periodic checking
- Key methods: detect(), isMotionDetected()

### DetectionService (`server/src/services/detection/detectionService.ts`)
- Purpose: Unified detection interface
- Pattern: Facade for multiple detection implementations
- Key methods: triggerDetection(), batchDetect()

## Entry Points

### Frontend Entry
- **Location:** `frontend/src/main.tsx`
- **Triggers:** Browser loads index.html, React mounts App
- **Responsibilities:** Initialize React Query, Socket.io, Auth context

### Backend Entry
- **Location:** `server/src/index.ts`
- **Triggers:** Node.js starts with `npx tsx watch src/index.ts`
- **Responsibilities:** Express setup, Socket.io init, database connection, stream setup

### OpenCV Service Entry
- **Location:** `opencv-service/app.py`
- **Triggers:** Flask app starts on port 8084
- **Responsibilities:** HTTP endpoints for detection, face recognition, object detection

## Error Handling

**Strategy:** Try-catch with centralized logging

**Patterns:**
- Logger utility (`server/src/utils/logger.ts`) for structured logging
- Error boundaries in React (`frontend/src/components/ErrorBoundary.tsx`)
- Global error handlers in Express (middleware)
- Socket.io reconnection logic

## Cross-Cutting Concerns

**Logging:** Custom logger with levels (debug, info, warn, error, performance) + file output

**Validation:** Zod schemas in `server/src/schemas/validationSchemas.ts`

**Authentication:** JWT with access tokens (15 min) + refresh tokens (7 days) + TOTP MFA

**Rate Limiting:** express-rate-limit with per-endpoint configuration

**Security:** Helmet.js, CORS, audit logging, credential encryption

---

*Architecture analysis: 2026-05-05*