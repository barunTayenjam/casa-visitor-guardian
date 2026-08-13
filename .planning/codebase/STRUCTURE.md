---
mapped: 2026-08-13
focus: arch
---

# Codebase Structure

> Generated from codebase analysis on 2026-08-13

## Top-Level Layout

```
sentryvision/
├── frontend/             # React/TypeScript frontend application
├── server/               # Express/TypeScript backend API
├── opencv-service/       # Python OpenCV for AI processing
├── database/             # TypeORM database migrations
├── docs/                 # Project documentation and diagrams
├── scripts/              # Utility scripts (health, diagnose, deploy, etc.)
├── .planning/            # Codebase analysis, plans, and generated documents
├── docker/               # Docker-related files
├── data/                 # Persistent data storage (detections, snapshots, logs)
├── public/               # Frontend build output and static assets
├── package.json          # Node.js project dependencies and scripts
├── docker-compose.yml    # Docker Compose setup for all services
├── .env                  # Environment variables for local development
└── README.md             # Project overview and setup instructions
```

## Key Locations

### Frontend (`frontend/src/`)
- **Pages**: `frontend/src/pages/` - Route-level views like `StreamDashboard.tsx`, `EventsPage.tsx`, `Settings.tsx`
- **Components**: `frontend/src/components/` - Reusable UI components organized by domain (`live/`, `events/`, `layout/`, `ui/`)
- **Services**: `frontend/src/services/` - API clients (`api/`) and Socket.io client (`SocketService.ts`)
- **Contexts**: `frontend/src/contexts/` - React Context providers (`AuthContext.tsx`, `CameraContext.tsx`, `SocketContext.tsx`)
- **Hooks**: `frontend/src/hooks/` - Custom React hooks
- **Types**: `frontend/src/types/` - TypeScript type definitions
- **Lib**: `frontend/src/lib/` - Utility functions (`utils.ts`, `logger.ts`)

### Backend (`server/src/`)
- **Entry Point**: `server/src/index.ts` - Express app bootstrap, Socket.io setup
- **Bootstrap**: `server/src/bootstrap.ts` - Service initialization, database connection, camera loading
- **Controllers**: `server/src/controllers/` - MVC controllers handling request logic (e.g., `CameraController.ts`, `EventController.ts`)
- **Routes**: `server/src/routes/` - Express route definitions, mounting controllers (e.g., `auth.ts`, `cameras.ts`, `events.ts`)
- **Services**: `server/src/services/` - Business logic, external integrations (e.g., `nvidiaAnalysisService.ts`, `opencvMicroserviceClient.ts`, `retentionPolicyService.ts`)
- **Models**: `server/src/models/` - TypeORM entities (e.g., `User.ts`, `Event.ts`, `Camera.ts`)
- **Middleware**: `server/src/middleware/` - Authentication, validation, rate limiting
- **Config**: `server/src/config/` - Application configuration
- **Utils**: `server/src/utils/` - Helper functions (`logger.ts`, `cronJobs.ts`)
- **Streams**: `server/src/streams/` - RTSP stream management (`rtspManager.ts`)
- **Database**: `server/src/database.ts` - TypeORM data source and initialization
- **Migrations**: `server/src/migrations/` - TypeORM database migrations

### OpenCV Service (`opencv-service/`)
- **Main App**: `opencv-service/app.py` - Flask application entry point
- **Pipeline**: `opencv-service/pipeline.py` - Core detection pipeline logic
- **Models**: `opencv-service/models/` - AI model files
- **Routes**: `opencv-service/routes/` - Flask API routes
- **RTSP Ingestion**: `opencv-service/rtsp_ingestion/` - RTSP stream reading components

## Naming Conventions

### Files
- **TypeScript/React**:
  - Components: PascalCase (e.g., `StreamDashboard.tsx`, `AppLayout.tsx`)
  - Utilities/Services: camelCase (e.g., `apiService.ts`, `utils.ts`, `auth.ts`)
  - Contexts: PascalCase (e.g., `AuthContext.tsx`)
  - Type definitions: camelCase (e.g., `api.ts`, `camera.ts`)
- **Python**: snake_case (e.g., `app.py`, `pipeline.py`)

### Directories
- **Frontend**: kebab-case (e.g., `components/live`, `services/api`)
- **Backend**: kebab-case (e.g., `controllers`, `services`, `middleware`)
- **OpenCV**: snake_case (e.g., `rtsp_ingestion`)

## Module Organization

### Frontend
- Organized primarily by **type** (pages, components, services, contexts).
- Components are further organized by **feature/domain** within `components/` (e.g., `components/live`, `components/events`).

### Backend
- Primarily organized by **type** (controllers, routes, services, models, middleware).
- Services are further organized into **sub-domains** within `services/` (e.g., `services/detection/`, `services/review/`).

## Configuration Locations

- **Environment Variables**: `.env`, `.env.example` at the project root for local development and deployment.
- **Backend Config**: `server/src/config/index.ts` for application-wide settings.
- **Camera Config**: `server/cameras.json` (gitignored, template in `cameras.example.json`) for camera-specific RTSP URLs, zones, and tracked objects.
- **Vite Config**: `frontend/vite.config.ts` for frontend build and API proxy settings.
- **Docker Compose**: `docker-compose.yml` for service definitions and environment variables.

---

*Structure analysis: 2026-08-13*