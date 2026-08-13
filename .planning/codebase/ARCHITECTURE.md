---
mapped: 2026-08-13
focus: arch
---

# Architecture

> Generated from codebase analysis on 2026-08-13

## Pattern

The SentryVision system follows a **monolithic backend architecture** with a separate frontend and dedicated AI processing service. The backend is built on Express.js with TypeScript, utilizing TypeORM for database access and Socket.io for real-time communication. The AI processing is handled by a separate Python-based OpenCV service that communicates with the backend via WebSocket.

## Layers

### Frontend Layer
- **Technology**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Location**: `frontend/src/`
- **Responsibilities**: User interface, routing, state management via React Contexts, real-time updates via Socket.io
- **Key Files**: `frontend/src/App.tsx`, `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/services/`

### Backend Layer
- **Technology**: Express 5, TypeScript, TypeORM, Socket.io
- **Location**: `server/src/`
- **Responsibilities**: API endpoints, database access, real-time event handling, service orchestration
- **Key Files**: `server/src/index.ts` (entry point), `server/src/bootstrap.ts` (service initialization), `server/src/routes/` (API routing), `server/src/services/` (business logic)

### AI Processing Layer
- **Technology**: Python, Flask, OpenCV, YOLOv8, InsightFace
- **Location**: `opencv-service/`
- **Responsibilities**: Video frame processing, object detection, face recognition, motion detection
- **Key Files**: `opencv-service/app.py`, `opencv-service/pipeline.py`, `opencv-service/person_analyzer.py`

### Database Layer
- **Technology**: PostgreSQL 15+
- **Location**: External database
- **Responsibilities**: Data persistence for events, users, cameras, and system configuration
- **ORM**: TypeORM with models in `server/src/models/`

## Data Flow

### Primary Request Path
1. **Frontend Request**: User interacts with React frontend → API calls to backend
2. **Backend Processing**: Express routes handle requests → Controllers execute business logic → TypeORM queries database
3. **AI Service Integration**: Backend communicates with OpenCV service via WebSocket for real-time detection
4. **Event Processing**: OpenCV processes video frames → Sends detection events back to backend via WebSocket
5. **Database Persistence**: Backend saves events to PostgreSQL → Forwards events to frontend via Socket.io
6. **Frontend Update**: React components receive real-time updates via Socket.io and update UI

### Real-Time Event Flow
1. OpenCV service detects motion/objects → Sends `trackingEvent` via WebSocket to backend
2. Backend processes event in `bootstrap.ts` → Persists to database via `Event` model
3. Backend emits Socket.io events to frontend rooms:
   - `personDetected` for person detections
   - `faceDetected` for face recognitions  
   - `detection` for general object detections
   - `motionDetected` for motion alerts
4. Frontend components in `camera-${cameraId}-live` rooms receive and display frames

## Key Abstractions

### Service Registry Pattern
- **Purpose**: Centralized service management and dependency injection
- **Implementation**: `server/src/services/serviceRegistry.ts`
- **Pattern**: Singleton registry with typed getters/setters for all backend services
- **Services Registered**: Database, stream manager, detection services, notification service, Python WebSocket client

### Stream Manager
- **Purpose**: RTSP stream orchestration and WebSocket room management
- **Implementation**: `server/src/streams/rtspManager.ts`
- **Key Features**: Adaptive FPS based on viewer count, camera connection tracking, health monitoring, Python WebSocket integration

### Python WebSocket Client
- **Purpose**: Communication with OpenCV service
- **Implementation**: `server/src/services/pythonWsClient.ts`
- **Protocol**: WebSocket with binary frame support for video data and JSON for control messages
- **Events**: `connected`, `disconnected`, `frame`, `trackingEvent`

### Event Model
- **Purpose**: Standardized event persistence and data structure
- **Implementation**: `server/src/models/Event.ts`
- **Structure**: UUID primary key, event type, severity, file path, timestamp, detection metadata
- **Indexes**: Event type, timestamp, and severity for efficient querying

## Entry Points

### Backend Entry Point
- **Location**: `server/src/index.ts`
- **Responsibilities**: Express server initialization, Socket.io setup, route configuration, static file serving
- **Key Components**: 
  - Express app with compression, CORS, and security middleware
  - Go2RTC proxy for RTSP streaming
  - Socket.io server for real-time communication
  - Route configuration via `configureRoutes`

### Frontend Entry Point
- **Location**: `frontend/src/main.tsx`
- **Responsibilities**: React app initialization, error handling, performance monitoring
- **Key Components**:
  - React root creation with StrictMode
  - Global error boundaries
  - Performance monitoring with PerformanceObserver
  - Service worker registration

### OpenCV Service Entry Point
- **Location**: `opencv-service/app.py`
- **Responsibilities**: Flask app initialization, WebSocket server setup, pipeline orchestration
- **Key Components**: Video frame processing pipeline, face recognition, object detection

## State Management

### Backend State Management
- **Service Registry**: Centralized service state via `serviceRegistry.ts`
- **In-Memory State**: `server/src/services/inMemoryStateService.ts` for transient state
- **Database State**: Persistent state stored in PostgreSQL tables
- **Stream State**: Camera connection and frame state managed by `StreamManager`

### Frontend State Management
- **React Contexts**: 
  - `AuthContext.tsx` for authentication state
  - `SocketContext.tsx` for Socket.io connection
  - `CameraContext.tsx` for camera and stream state
- **React Query**: Data fetching and caching via `@tanstack/react-query`
- **Local State**: Component-level state managed with React hooks

## Real-Time Communication

### WebSocket Architecture
- **Backend-OpenCV**: WebSocket connection at `ws://localhost:9090` for frame data and control messages
- **Backend-Frontend**: Socket.io for real-time updates with room-based broadcasting
- **Communication Patterns**:
  - Binary frames for video data
  - JSON messages for control and event data
  - Room-based broadcasting for camera-specific updates

### Socket.io Implementation
- **Server**: Integrated with Express server in `index.ts`
- **Client**: `frontend/src/services/SocketService.ts` for connection management
- **Event Types**: 
  - `frame`: Video frames for live streaming
  - `personDetected`: Person detection alerts
  - `faceDetected`: Face recognition results
  - `detection`: General object detections
  - `motionDetected`: Motion detection alerts

## Cross-Cutting Concerns

### Logging
- **Backend**: Structured logging via `server/src/utils/logger.ts`
- **Frontend**: Client-side logging with performance monitoring
- **OpenCV**: Logging via Python's logging module

### Error Handling
- **Global Error Boundaries**: Frontend error handling in `ErrorBoundary.tsx`
- **Backend Error Handling**: Express error middleware and structured error responses
- **WebSocket Error Handling**: Reconnection logic and silence detection

### Authentication
- **JWT-based authentication** with refresh tokens
- **Role-based access control** (admin, user)
- **MFA support** for enhanced security

### Configuration Management
- **Environment-based configuration** via `dotenv`
- **Centralized config** in `server/src/config/index.ts`
- **Camera configuration** stored in `cameras.json` and database

---

*Architecture analysis: 2026-08-13*