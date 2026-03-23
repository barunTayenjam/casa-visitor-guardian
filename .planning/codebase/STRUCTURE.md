# SentryVision Codebase Structure

## Directory Layout

```
home-security-non-docker/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── ui/          # shadcn/ui primitives
│   │   │   ├── dashboard/   # Dashboard-specific components
│   │   │   ├── live/        # Live streaming components
│   │   │   ├── events/      # Event display components
│   │   │   └── analytics/   # Analytics charts
│   │   ├── contexts/        # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Route-level page components
│   │   ├── services/        # API client layer
│   │   ├── lib/             # Utility functions
│   │   ├── types/           # TypeScript type definitions
│   │   └── styles/          # Global styles
│   ├── public/              # Static assets
│   ├── package.json         # Frontend dependencies
│   ├── vite.config.ts       # Vite build configuration
│   └── tsconfig.json        # TypeScript configuration
│
├── server/                  # Node.js backend application
│   ├── src/
│   │   ├── routes/          # API endpoint handlers
│   │   ├── services/        # Business logic layer
│   │   ├── models/          # TypeORM entity models
│   │   ├── middleware/      # Express middleware
│   │   ├── detection/       # Motion detection logic
│   │   ├── streams/         # RTSP stream management
│   │   ├── config/          # Configuration files
│   │   ├── utils/           # Utility functions
│   │   ├── types/           # TypeScript types
│   │   └── index.ts         # Application entry point
│   ├── tests/               # Backend tests
│   ├── cameras.json         # Camera configuration
│   ├── package.json         # Backend dependencies
│   └── tsconfig.json        # TypeScript configuration
│
├── opencv-service/          # Python Flask computer vision service
│   ├── app.py              # Main Flask application
│   ├── improved_face_recognition.py  # Face recognition engine
│   ├── models/             # ML model files
│   ├── known_faces/        # Known face embeddings
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Python service container
│
├── database/               # Database migrations
│   ├── migrations/         # SQL migration files (001-014)
│   ├── run-migrations.ts   # Migration runner script
│   └── package.json        # Migration dependencies
│
├── data/                   # Runtime data (not in git)
│   ├── detections/         # Event images
│   ├── events/             # Event metadata
│   ├── snapshots/          # Manual snapshots
│   ├── postgres/           # PostgreSQL data (Docker volume)
│   └── redis/              # Redis data (Docker volume)
│
├── .planning/              # Project planning documents
│   └── codebase/           # Codebase analysis (this directory)
│
├── docker-compose.yml      # Multi-service orchestration
├── package.json            # Root package.json (scripts only)
└── AGENTS.md               # Agent documentation
```

## Frontend Structure (`/frontend/src`)

### Components (`/components`)

**UI Components (`/components/ui`)**
- shadcn/ui primitives (Radix UI)
- 35+ component files (button, dialog, dropdown, etc.)
- Styled with TailwindCSS
- Fully accessible

**Feature Components:**
```
components/
├── dashboard/              # Dashboard-specific
│   ├── CameraGrid.tsx     # Camera layout grid
│   ├── RecentDetectionsCarousel.tsx
│   └── SystemOverview.tsx
├── live/                  # Live streaming
│   ├── CameraView.tsx     # Single camera view
│   └── StreamControls.tsx # Stream control buttons
├── events/                # Event display
│   ├── EventCard.tsx      # Event list item
│   ├── EventDetails.tsx   # Event detail view
│   └── EventFilters.tsx   # Filter controls
└── analytics/             # Analytics
    ├── EventChart.tsx     # Recharts visualization
    └── StatsCard.tsx      # Statistic display
```

### Pages (`/pages`)
- Route-level components (lazy-loaded)
- `Login.tsx` - Authentication page
- `StreamDashboard.new.tsx` - Main dashboard
- `EventsPage.new.tsx` - Events list with filters
- `Analytics.new.tsx` - Analytics and charts
- `VisitorTimeline.new.tsx` - Visitor timeline
- `Review.new.tsx` - Review segments
- `Settings.new.tsx` - Settings page
- `BatchDetectionPage.tsx` - Batch detection
- `DayHighlights.new.tsx` - Daily highlights

### Contexts (`/contexts`)
- `AuthContext.tsx` - Authentication state (user, tokens, MFA)
- `SocketContext.tsx` - Socket.io connection
- `CameraContext.tsx` - Camera state and controls
- `EventsContext.tsx` - Real-time event updates

### Services (`/services`)
- `ApiService.ts` - API client (axios wrapper)
- Endpoints for all backend routes
- Token management
- Error handling

### Hooks (`/hooks`)
- Custom React hooks
- `useAuth.ts` - Authentication helper
- `useCamera.ts` - Camera stream management
- `useEvents.ts` - Event data fetching
- `useSocket.ts` - Socket.io helper

### Types (`/types`)
- `security.ts` - Security-related types
- API response types
- Event, Visitor, Camera types

### Utilities (`/lib`)
- `utils.ts` - General utilities
- Tailwind merge functions
- Date formatting helpers

## Backend Structure (`/server/src`)

### Routes (`/routes`)
**Main Routes:**
- `index.ts` - Primary routes (16,000+ lines)
- `auth.ts` - Authentication (login, MFA, logout)
- `visitorRoutes.ts` - Visitor management
- `timelineRoutes.ts` - Timeline queries
- `reviewRoutes.ts` - Review segments
- `detectionRoutes.ts` - Object/face detection
- `detectionRedoRoutes.ts` - Re-run detection
- `batchDetection.ts` - Batch processing
- `storageRoutes.ts` - Storage management
- `notificationRoutes.ts` - Notifications
- `faceEmbeddingRoutes.ts` - Face embeddings
- `faceConfigRoutes.ts` - Face recognition config

**Route Pattern:**
```typescript
router.get('/path', middleware, handler);
router.post('/path', middleware, validation, handler);
router.put('/path', middleware, validation, handler);
router.delete('/path', middleware, handler);
```

### Services (`/services`)
**Detection Services:**
```
services/detection/
├── detectionService.ts       # Main detection logic
└── enhancedDetectionService.ts  # Enhanced detection
```

**Other Services:**
- `authenticationService.ts` - Auth business logic
- `review/reviewService.ts` - Review segments
- `timeline/timelineService.ts` - Timeline queries
- `notificationService.ts` - Email and push notifications
- `batchProcessingService.ts` - Batch detection jobs
- `opencvMicroserviceClient.ts` - OpenCV service client
- `redisCache.ts` - Redis caching layer
- `circuitBreaker.ts` - Fault tolerance
- `storageStatsService.ts` - Storage statistics
- `retentionPolicyService.ts` - Data retention
- `automatedCleanupService.ts` - Scheduled cleanup
- `totpService.ts` - TOTP MFA
- `sessionManager.ts` - Session management
- `fileIndexingService.ts` - File indexing
- `eventQueueService.ts` - Event queue management

### Models (`/models`)
**TypeORM Entities:**
- `User.ts` - User accounts
- `Role.ts` - User roles
- `UserSession.ts` - JWT sessions
- `PasswordHistory.ts` - Password history
- `AuditLog.ts` - Security audit trail
- `Event.ts` - Motion events (1,050+ records)
- `Visitor.ts` - Visitor records
- `Timeline.ts` - Timeline events
- `DetectionConfig.ts` - Detection configuration
- `ProcessedImage.ts` - Processed images
- `AdaptiveRegion.ts` - Detection zones
- `ReviewSegment.ts` - Review segments
- `UserReviewStatus.ts` - Review tracking
- `BatchJob.ts` - Batch processing jobs
- `NotificationPreferences.ts` - Notification settings
- `NotificationLog.ts` - Notification history
- `NotificationSubscription.ts` - Web push subscriptions
- `FaceEmbedding.ts` - Face embeddings
- `StorageStats.ts` - Storage usage
- `RetentionPolicy.ts` - Retention rules
- `SystemSettings.ts` - System configuration

**Entity Pattern:**
```typescript
@Entity('table_name')
export class Entity {
  @PrimaryColumn()
  id: string;

  @Column()
  field: type;

  @Relation(...)
  relation: RelatedEntity;
}
```

### Detection (`/detection`)
- `optimizedMotionDetection.ts` - Main motion detection (988 lines)
- `simpleMotionDetection.ts` - Basic detection (138 lines)
- `motionTriggeredDetection.ts` - Motion-triggered object/face detection (664 lines)
- `consolidatedDetectionService.ts` - Unified detection interface
- `objectDetection.ts` - YOLO object detection

**Detection Flow:**
```
RTSP Frame
  ↓
Background Subtraction (MOG2)
  ↓
Contour Detection
  ↓
Threshold Check
  ↓
Motion Event Trigger
  ↓
Object/Face Detection (async)
```

### Streams (`/streams`)
- `rtspManager.ts` - RTSP stream orchestrator (900 lines)
- `streamManager.ts` - Stream abstraction
- `streamHealthMonitor.ts` - Health monitoring

**Stream Architecture:**
```
StreamManager
  ↓
Camera (per camera)
  ↓
FFmpeg Process (shared across roles)
  ↓
Frame Extraction
  ↓
Socket.io Broadcast
```

### Middleware (`/middleware`)
- `auth.ts` - JWT verification
- `rateLimit.ts` - Rate limiting
- `validation.ts` - Request validation (Zod)
- `errorHandler.ts` - Global error handling

### Config (`/config`)
- `index.ts` - Main configuration exports
- `detectionConfig.ts` - Detection settings

**Configuration Sources:**
- Environment variables (.env)
- cameras.json (camera config)
- Database (system_settings table)

### Utils (`/utils`)
- `logger.ts` - Debug logging
- `testImageGenerator.ts` - Test frame generation
- File path utilities

### Tests (`/tests`)
- `auth.test.ts` - Authentication endpoint tests
- `batchDetection.test.ts` - Batch processing tests
- `reviewRoutes.test.ts` - Review endpoint tests
- `visitorRoutes.test.ts` - Visitor endpoint tests

## OpenCV Service Structure (`/opencv-service`)

### Main Application
- `app.py` - Flask application (1,200+ lines)
  - Routes: /detect, /detect-objects, /recognize-faces, /compare-face
  - MOG2 motion detection
  - Face recognition pipeline
  - Error handling and logging

### Face Recognition
- `improved_face_recognition.py` - Face recognition engine
  - Face detection (HOG/CNN)
  - Face embedding generation
  - Face comparison (euclidean distance)
  - Known face management

### Data Directories
- `models/` - ML model files (dlib, face recognition)
- `known_faces/` - Known face embeddings
- `data/` - Temporary detection data

## Database Structure (`/database`)

### Migrations (`/migrations`)
**Migration Files (14 total):**
1. `001_create_user_management.sql` - Users, roles, sessions
2. `002_create_detection_cache_postgres.sql` - Detection cache
3. `003_create_events_table.sql` - Events table
4. `004_create_batch_processing.sql` - Batch jobs
5. `005_create_visitor_tables.sql` - Visitor tables
6. `006_enhance_events_table.sql` - Event enhancements
7. `007_create_review_timeline_tables.sql` - Review/timeline
8. `008_fix_missing_tables_and_mismatches.sql` - Fixes
9. `009_add_face_embeddings_table.sql` - Face embeddings
10. `010_add_face_recognition_config.sql` - Face config
11. `011_event_search_indexes.sql` - Performance indexes
12. `012_add_unknown_faces_tracking.sql` - Unknown faces
13. `013_create_storage_stats.sql` - Storage stats
14. `014_recreate_storage_stats.sql` - Stats fixes

**Migration Runner:**
- `run-migrations.ts` - Executes pending migrations
- Uses `pg` client directly
- Tracks applied migrations

## Configuration Files

### Root Level
- `docker-compose.yml` - Service orchestration
- `package.json` - Root scripts (dev, build, docker commands)
- `.env.example` - Environment variable template

### Frontend
- `vite.config.ts` - Vite build config, proxy setup
- `tailwind.config.js` - TailwindCSS customization
- `components.json` - shadcn/ui configuration
- `tsconfig.json` - TypeScript config (strict: false)

### Backend
- `tsconfig.json` - TypeScript config (ES2022, strict: false)
- `cameras.json` - Camera RTSP URLs, zones, objects
- `.env` - Environment variables (not in git)

### OpenCV Service
- `requirements.txt` - Python dependencies
- `Dockerfile` - Python container

## Key Files and Their Purposes

### Entry Points
| File | Purpose |
|------|---------|
| `frontend/src/main.tsx` | React app entry |
| `server/src/index.ts` | Express server entry (635 lines) |
| `opencv-service/app.py` | Flask service entry (1,200+ lines) |

### Configuration
| File | Purpose |
|------|---------|
| `server/cameras.json` | Camera config (RTSP URLs, zones) |
| `docker-compose.yml` | Service orchestration |
| `frontend/vite.config.ts` | Frontend build config |
| `server/src/config/index.ts` | Backend config loader |

### Core Logic
| File | Purpose | Lines |
|------|---------|-------|
| `server/src/streams/rtspManager.ts` | RTSP stream management | 900 |
| `server/src/detection/optimizedMotionDetection.ts` | Motion detection | 988 |
| `server/src/routes/index.ts` | Main API routes | 16,000+ |
| `opencv-service/app.py` | OpenCV service | 1,200+ |

### Models
| File | Purpose |
|------|---------|
| `server/src/models/Event.ts` | Event entity |
| `server/src/models/User.ts` | User entity |
| `server/src/models/Visitor.ts` | Visitor entity |

## File Naming Conventions

### Frontend
- **Components:** PascalCase (e.g., `CameraGrid.tsx`, `EventCard.tsx`)
- **Pages:** PascalCase with suffix (e.g., `StreamDashboard.new.tsx`)
- **Hooks:** camelCase with 'use' prefix (e.g., `useAuth.ts`, `useCamera.ts`)
- **Services:** camelCase (e.g., `apiService.ts`)
- **Types:** camelCase (e.g., `security.ts`)

### Backend
- **Routes:** camelCase with suffix (e.g., `auth.ts`, `visitorRoutes.ts`)
- **Services:** camelCase with suffix (e.g., `detectionService.ts`)
- **Models:** PascalCase (e.g., `User.ts`, `Event.ts`)
- **Middleware:** camelCase (e.g., `auth.ts`, `rateLimit.ts`)
- **Utils:** camelCase (e.g., `logger.ts`)

### Database
- **Migrations:** `###_description.sql` (numbered, 001-014)

## Code Organization Patterns

### Frontend Pattern
```
Feature Component
  ├── Sub-components (local folder)
  ├── Custom hooks (useFeature.ts)
  ├── Types (feature.types.ts)
  └── Tests (feature.test.ts)
```

### Backend Pattern
```
Feature
  ├── Routes (featureRoutes.ts)
  ├── Services (featureService.ts)
  ├── Models (Feature.ts)
  ├── Tests (feature.test.ts)
  └── Types (feature.types.ts)
```

## Import Conventions

### Frontend
```typescript
// External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal imports
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/security';
```

### Backend
```typescript
// External libraries
import express from 'express';
import { Repository } from 'typeorm';

// Internal imports
import { User } from '../models/User.js';
import { authenticationService } from '../services/authenticationService.js';
```

## Module System

### Frontend (ES Modules)
- Type: "module" in package.json
- Extension: `.ts`, `.tsx`
- Import: `import ... from 'module'`
- Export: `export ...`

### Backend (ES Modules)
- Type: "module" in package.json
- Extension: `.ts` (with `.js` in imports)
- Import: `import ... from './module.js'`
- Export: `export ...`

### Python (OpenCV Service)
- Import: `from module import thing`
- No explicit exports needed

## Testing Structure

### Frontend Tests
- Location: Alongside components
- Pattern: `*.test.ts`
- Framework: Jest + React Testing Library
- Examples: `setup.test.ts`, `services/ApiService.test.ts`

### Backend Tests
- Location: `server/tests/` and alongside routes
- Pattern: `*.test.ts`
- Framework: Jest + Supertest
- Examples: `auth.test.ts`, `reviewRoutes.test.ts`

## Static Assets

### Frontend Public
- Location: `frontend/public/`
- Served directly by Vite dev server
- Not processed by build

### Backend Public
- Location: `server/public/`
- Served via Express static middleware
- Includes: event images, snapshots

## Generated Files

### Frontend Build
- Location: `frontend/dist/`
- Generated by: `npm run build`
- Contents: Minified JS/CSS, index.html

### Backend Build
- Location: `server/dist/`
- Generated by: `npm run build`
- Contents: Compiled JavaScript from TypeScript

## Data Directories (Not in Git)

### Runtime Data
```
data/
├── detections/     # Event images (YYYY-MM/events/motion/)
├── events/         # Event metadata
├── snapshots/      # Manual snapshots
├── postgres/       # PostgreSQL data (Docker volume)
└── redis/          # Redis data (Docker volume)
```

### Managed Files
- Detection images: `data/detections/YYYY-MM/events/motion/*.jpg`
- Snapshots: `data/snapshots/*.jpg`
- Database: Stored in Docker volumes

## Configuration Management

### Environment Variables
**Frontend:** `VITE_*` prefix (exposed to client)
**Backend:** Standard `NODE_*`, `DB_*`, etc. (server-side only)

### Camera Configuration
- File: `server/cameras.json`
- Hot-reloaded in development
- Contains: RTSP URLs, zones, objects, thresholds

### Database Configuration
- Connection via TypeORM
- Config: `database/index.ts`
- Environment: `DB_*` variables

## Service Boundaries

### Frontend → Backend
- **Protocol:** HTTP/HTTPS
- **Format:** JSON
- **Authentication:** JWT in HttpOnly cookie
- **Real-time:** Socket.io

### Backend → OpenCV Service
- **Protocol:** HTTP
- **Format:** Multipart form data (images)
- **Authentication:** None (internal network)
- **Error Handling:** Circuit breaker pattern

### Backend → Database
- **Protocol:** TCP
- **Driver:** `pg` (node-postgres)
- **ORM:** TypeORM
- **Connection Pooling:** Managed by TypeORM

### Backend → Redis
- **Protocol:** TCP
- **Driver:** `redis` npm package
- **Usage:** Caching, sessions, pub/sub

## Key Locations Summary

| What You Want | Where to Look |
|---------------|---------------|
| Add API endpoint | `server/src/routes/` |
| Add business logic | `server/src/services/` |
| Add database table | `database/migrations/` + `server/src/models/` |
| Add UI component | `frontend/src/components/` |
| Add page/route | `frontend/src/pages/` + `App.tsx` routing |
| Configure cameras | `server/cameras.json` |
| Detection logic | `server/src/detection/` |
| Stream processing | `server/src/streams/` |
| OpenCV operations | `opencv-service/app.py` |
| Type definitions | `frontend/src/types/`, `server/src/types/` |
| Tests | `frontend/src/**/*.test.ts`, `server/tests/` |
| Configuration | `server/src/config/`, `.env` files |
| Docker setup | `docker-compose.yml`, `Dockerfile`s |
