# SentryVision Architecture

## System Overview

SentryVision is a distributed home security system with a three-tier architecture: React frontend, Node.js/Express backend, and PostgreSQL database. A Python Flask microservice handles computer vision operations (OpenCV), and Redis provides caching. The system processes RTSP camera feeds for real-time motion detection, facial recognition, and object detection.

## Architectural Pattern

**Three-tier client-server architecture** with microservice elements:

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  State: Context API + React Query                           │
│  Real-time: Socket.io Client                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP + WebSocket
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Node.js/Express)                   │
│  API: REST + WebSocket (Socket.io)                          │
│  Auth: JWT + TOTP MFA                                       │
│  Business Logic: Services                                   │
└─────┬───────────────┬───────────────┬───────────────────────┘
      │               │               │
      ↓               ↓               ↓
┌───────────┐  ┌─────────────┐  ┌──────────┐
│ OpenCV    │  │ PostgreSQL  │  │  Redis   │
│ Service   │  │ Database    │  │  Cache   │
│ (Python)  │  │             │  │          │
└───────────┘  └─────────────┘  └──────────┘
```

## Core Architectural Layers

### 1. Presentation Layer (Frontend)

**Framework:** React 18 with TypeScript

**Key Patterns:**
- **Component composition:** Functional components with hooks
- **Context pattern:** Global state via React Context (Auth, Camera, Socket, Events)
- **Server state:** React Query for API caching and synchronization
- **Client-side routing:** React Router v6
- **Lazy loading:** Code splitting with React.lazy()
- **Error boundaries:** Error isolation per component tree

**State Management:**
- **Local state:** useState, useReducer
- **Global state:** Context API (AuthContext, CameraContext, SocketContext, EventsContext)
- **Server state:** React Query (automatic caching, revalidation, background updates)
- **Form state:** React Hook Form with Zod validation

**Data Flow:**
```
User Interaction
    ↓
Component Event Handler
    ↓
Context Action / API Call (React Query)
    ↓
Backend API
    ↓
State Update (Re-render)
```

### 2. Application Layer (Backend)

**Framework:** Express with TypeScript (ES modules)

**Key Patterns:**
- **Middleware chain:** CORS, JSON parsing, authentication, rate limiting, validation
- **Router separation:** Modular route files (auth, events, visitors, detection, etc.)
- **Service layer:** Business logic isolated in services/
- **Repository pattern:** TypeORM entities for database access
- **Dependency injection:** Services receive dependencies via constructor
- **Event-driven:** EventEmitter for internal pub/sub

**Request Processing Pipeline:**
```
Incoming Request
    ↓
CORS Middleware
    ↓
JSON Parser
    ↓
Rate Limiter
    ↓
Authentication Middleware (JWT)
    ↓
Authorization Check (Role-based)
    ↓
Route Handler
    ↓
Service Layer (Business Logic)
    ↓
Repository (TypeORM)
    ↓
Database
    ↓
Response
```

**Service Layer Architecture:**
- `authenticationService.ts` - Auth logic (login, MFA, tokens)
- `detectionService.ts` - Detection operations
- `reviewService.ts` - Review segment management
- `timelineService.ts` - Timeline queries
- `notificationService.ts` - Email and push notifications
- `batchProcessingService.ts` - Async batch detection jobs
- `opencvMicroserviceClient.ts` - OpenCV service client

### 3. Data Layer (Database)

**ORM:** TypeORM with PostgreSQL

**Patterns:**
- **Active Record:** Models inherit from TypeORM BaseEntity
- **Repository pattern:** `repository.findOne()`, `repository.find()`
- **Relations:** Eager loading with `relations` option
- **Migrations:** SQL files in `database/migrations/`
- **Transactions:** Critical operations wrapped in transactions

**Entity Models (17 tables):**
- `User`, `Role`, `UserSession` - User management
- `Event`, `DetectionConfig`, `ProcessedImage` - Detection data
- `Visitor`, `Timeline` - Visitor tracking
- `ReviewSegment`, `UserReviewStatus` - Review workflow
- `BatchJob` - Async processing
- `NotificationPreferences`, `NotificationLog` - Notifications
- `StorageStats`, `RetentionPolicy` - Storage management

### 4. Infrastructure Layer

**RTSP Stream Processing:**
```
RTSP Camera (IP Camera)
    ↓
FFmpeg (child process)
    ↓
Frame Extraction (JPEG)
    ↓
Motion Detection (OpenCV Service)
    ↓
Event Trigger
    ↓
Database + Notification
```

**Real-time Communication:**
- **Protocol:** WebSocket via Socket.io
- **Server:** Socket.io 4.7.2 (backend)
- **Client:** Socket.io Client 4.8.1 (frontend)
- **Rooms:** Camera-specific rooms for streaming
- **Events:** `requestStream`, `frame`, `motionDetected`, `objectDetected`

**Computer Vision Service:**
- **Framework:** Flask (Python)
- **Port:** 8084
- **Protocol:** HTTP (REST)
- **Communication:** Backend → Axios → OpenCV Service
- **Operations:** Motion detection, face recognition, object detection

## Data Flow Patterns

### Authentication Flow

```
1. POST /api/auth/login
   ↓
2. authenticationService validates credentials
   ↓
3. bcrypt.compare() for password
   ↓
4. Check MFA enabled
   ↓
5. Generate JWT tokens (access + refresh)
   ↓
6. Store session in user_sessions table
   ↓
7. Set HttpOnly cookies
   ↓
8. Return user data
```

### Motion Detection Flow

```
1. RTSP Stream (FFmpeg child process)
   ↓
2. Extract frames at 2-4 FPS
   ↓
3. Send to OpenCV Service (/detect endpoint)
   ↓
4. Background subtraction (MOG2)
   ↓
5. Contour detection
   ↓
6. Motion threshold check
   ↓
7. If motion detected:
   a. Save image to disk
   b. Create Event record in DB
   c. Emit Socket.io event
   d. Send notification
   ↓
8. Trigger object/face detection (async)
```

### Camera Streaming Flow

```
Client: Socket.emit('requestStream', { cameraId })
    ↓
Backend: StreamManager.startStream(cameraId)
    ↓
FFmpeg: Spawn child process for RTSP stream
    ↓
Frame Loop: Extract JPEG at 4 FPS
    ↓
Socket.io: Emit 'frame' event to client room
    ↓
Client: Update <img> src with base64 frame
    ↓
Client: Socket.emit('stopStream') when done
    ↓
Backend: Kill FFmpeg process, cleanup
```

### Face Recognition Flow

```
1. Motion detected with person
   ↓
2. Send frame to OpenCV Service (/recognize-faces)
   ↓
3. Face detection (dlib CNN)
   ↓
4. Face embedding (128-d vector)
   ↓
5. Compare with known_faces database
   ↓
6. Euclidean distance < 0.6 = match
   ↓
7. Update Event with face_detections
   ↓
8. If unknown face:
   a. Create Visitor record
   b. Emit alert
   ↓
9. Store embedding in face_embeddings table
```

## Key Architectural Decisions

### Why Three-tier Architecture?
- **Separation of concerns:** UI, business logic, data isolated
- **Scalability:** Each tier can scale independently
- **Maintainability:** Clear boundaries between layers
- **Testability:** Each layer can be tested independently

### Why Microservice for OpenCV?
- **Isolation:** Python CV libraries don't pollute Node.js
- **Resource management:** CV operations in separate process
- **Fault tolerance:** OpenCV crash doesn't crash backend
- **Technology fit:** Python has better CV library ecosystem

### Why Socket.io?
- **Automatic fallback:** WebSocket → long polling
- **Room-based messaging:** Efficient camera streaming
- **Reconnection:** Automatic reconnection handling
- **Cross-browser:** Works on all browsers

### Why TypeORM?
- **TypeScript-first:** Great type safety
- **Active Record pattern:** Simple query API
- **Migrations:** Built-in migration support
- **Decorators:** Clean entity definitions

### Why React Query?
- **Server state:** Separate from client state
- **Automatic caching:** Reduces API calls
- **Background refetch:** Fresh data automatically
- **Optimistic updates:** Better UX

## Security Architecture

### Authentication Layers
1. **Password hashing:** bcrypt with salt rounds
2. **JWT tokens:** Access (15min) + Refresh (7 days)
3. **TOTP MFA:** Optional 2FA via speakeasy
4. **Session tracking:** user_sessions table for revocation

### Authorization Layers
1. **Role-based access:** admin, user, viewer
2. **Route protection:** ProtectedRoute component (frontend)
3. **API middleware:** authMiddleware (backend)
4. **Permission checks:** role-based in services

### Data Security
1. **Input validation:** Zod schemas on all endpoints
2. **SQL injection prevention:** TypeORM parameterized queries
3. **XSS prevention:** React auto-escaping
4. **CORS:** Configured origins
5. **Rate limiting:** 100 req/15min per IP
6. **Security headers:** Helmet.js

### RTSP Security
- **Credentials in config:** Not in code
- **Local network:** RTSP not exposed externally
- **HTTPS proxy:** Recommended for remote access

## Scalability Architecture

### Horizontal Scaling
- **Stateless backend:** No session state in memory
- **Redis sessions:** Shared session store
- **Load balancing:** Can add backend instances
- **Database pooling:** TypeORM connection pool

### Vertical Scaling
- **Resource limits:** Docker CPU/memory limits
- **Low resource mode:** Configurable for 1-core systems
- **Adaptive FPS:** Reduce FPS based on viewer count
- **Detection interval:** Configurable (default 3s)

### Performance Optimizations
- **Code splitting:** React lazy loading
- **Image compression:** JPEG quality 80%
- **Detection caching:** Redis 1-hour TTL
- **Database indexes:** On timestamp, camera_id
- **Connection pooling:** TypeORM and pg

## Fault Tolerance

### Error Boundaries
- **React ErrorBoundary:** Isolate component errors
- **Global error handler:** Catch unhandled errors
- **Fallback UI:** Graceful error display

### Service Health
- **Health checks:** /api/health endpoint
- **Docker health checks:** All containers
- **Retry logic:** Exponential backoff
- **Circuit breaker:** opencvMicroserviceClient

### Data Integrity
- **Database transactions:** Multi-step operations
- **Rollback:** On transaction failure
- **Validation:** Before DB write
- **Audit logging:** All sensitive operations

## Concurrency Model

### Backend (Node.js)
- **Event loop:** Non-blocking I/O
- **Async/await:** All async operations
- **Worker threads:** For motion detection (experimental)
- **Child processes:** FFmpeg for RTSP streams

### Frontend (React)
- **Concurrent mode:** React 18 features
- **Suspense:** For lazy loading
- **Transitions:** Non-blocking UI updates

### OpenCV Service (Python)
- **Flask:** WSGI threads (default)
- **Synchronous:** CV operations block
- **No async:** Python's GIL limitation

## Deployment Architecture

### Container Strategy
- **Docker Compose:** Multi-container orchestration
- **Service isolation:** Each tier in separate container
- **Volume mounts:** Persistent data
- **Network isolation:** Internal Docker network

### Service Dependencies
```
frontend → backend → postgres
                   → redis
                   → opencv → postgres
                          → redis
```

### Resource Allocation
- **Backend:** 1 CPU core, 1GB RAM
- **Frontend:** 0.5 CPU core, 512MB RAM
- **PostgreSQL:** 0.25 CPU core, 384MB RAM
- **Redis:** 0.1 CPU core, 64MB RAM
- **OpenCV:** 0.5 CPU core, 512MB RAM

## Monitoring & Observability

### Health Monitoring
- **Health checks:** All services
- **Heartbeat:** Socket.io connections
- **Stream health:** StreamHealthMonitor

### Logging
- **Backend:** Debug library with namespaces
- **Frontend:** Browser console
- **Audit logs:** Database table

### Metrics
- **Storage stats:** storageStatsService
- **Event counts:** Database queries
- **Performance:** Detection time tracking

## Extension Points

### Adding New Detection Types
1. Add endpoint to OpenCV service (app.py)
2. Add client method in opencvMicroserviceClient.ts
3. Call from detection service
4. Store in Event model

### Adding New Cameras
1. Add entry to cameras.json
2. Restart backend (or hot reload)
3. Camera auto-registered in StreamManager

### Adding New Notifications
1. Add channel in notificationService.ts
2. Add user preferences in UI
3. Store in notification_preferences table

### Adding New Analytics
1. Add endpoint in analytics routes
2. Query database with aggregations
3. Create UI components with Recharts

## Technology Rationale

| Decision | Rationale |
|----------|-----------|
| React over Vue/Angular | Larger ecosystem, better TypeScript support |
| Express over Fastify/Koa | Mature ecosystem, middleware support |
| PostgreSQL over MongoDB | ACID compliance, better for security data |
| Python OpenCV over Node.js OpenCV | Better CV library ecosystem (face-recognition, dlib) |
| Socket.io over raw WebSocket | Automatic fallback, room-based messaging |
| Docker over bare metal | Consistent environment, easy deployment |
| Redis over in-memory cache | Persistent cache, shared across instances |

## Architectural Trade-offs

### Strengths
- ✅ Modular and maintainable
- ✅ Clear separation of concerns
- ✅ Type-safe (TypeScript)
- ✅ Real-time capable
- ✅ Fault-tolerant
- ✅ Easy to test

### Weaknesses
- ❌ Complexity overhead (multiple services)
- ❌ Docker resource overhead
- ❌ Python service adds deployment complexity
- ❌ TypeORM strict mode disabled (loose typing)
- ❌ No message queue (direct HTTP calls)

### Mitigations
- Docker Compose for simple deployment
- Resource limits for low-spec systems
- Health checks and monitoring
- Circuit breaker for external calls
- Comprehensive testing
