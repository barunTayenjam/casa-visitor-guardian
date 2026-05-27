# SentryVision

Home security system with real-time camera streaming, motion detection, facial recognition, and visitor analytics.

## Features

- **Real-time Streaming**: RTSP → FFmpeg → WebSocket delivery with adaptive quality
- **Motion Detection**: OpenCV MOG2 background subtraction with adaptive sensitivity and night mode
- **Object Detection**: YOLOv4-tiny tracking (person, car, dog, cat, package)
- **Facial Recognition**: Face detection, embedding, and known person matching via Python service
- **Visitor Analytics**: Timeline views, review segments, and visitor tracking
- **Multi-camera Support**: Zone-based detection with customizable tracking areas
- **AI Analysis**: NVIDIA-powered scene analysis for events
- **Notifications**: Push notification system with configurable preferences
- **Auth**: JWT + refresh tokens, TOTP MFA, role-based access (admin/user/viewer)

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │     │   Backend    │     │  OpenCV Svc  │
│   React 18   │◄───►│   Express    │◄───►│   Flask      │
│   :5173      │     │   :9753      │     │   :8084      │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
            ┌─────▼─────┐      ┌─────▼─────┐
            │ PostgreSQL│      │   Redis   │
            │   :5432   │      │   :6379   │
            └───────────┘      └───────────┘
```

| Service | Stack | Port |
|---------|-------|------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + Radix UI | 5173 |
| Backend | Node.js + Express 5 + TypeScript + TypeORM + Socket.io | 9753 |
| OpenCV | Python Flask + OpenCV (MOG2, YOLOv4-tiny, face recognition) | 8084 |
| Database | PostgreSQL 15+ with 28 migrations | 5432 |
| Cache | Redis (in-memory fallback) | 6379 |

## Quick Start

### Docker (Recommended)

```bash
git clone <repository-url> && cd home-security-non-docker
docker-compose up -d
docker-compose ps
docker-compose logs -f
```

### Local Development

```bash
npm install && cd server && npm install && cd ../frontend && npm install

createdb sentryvision
cd database && npm run migrate

npm run dev:full
```

### Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:9753 |
| OpenCV Service | http://localhost:8084 |

## Configuration

### Camera Setup

Edit `server/cameras.json` (see `server/cameras.example.json` for template):

```json
{
  "id": "cam1",
  "name": "Front Door",
  "streams": [{
    "path": "rtsp://user:pass@192.168.1.100:554/stream1",
    "roles": ["live", "detect", "record"],
    "width": 1920, "height": 1080, "fps": 4
  }],
  "objects": { "track": ["person", "car", "dog", "cat", "package"] },
  "zones": [
    {
      "id": "front_steps", "name": "Front Steps",
      "coordinates": [[0.1, 0.5], [0.4, 0.3], [0.5, 0.4], [0.2, 0.7]],
      "objects": ["person", "package"]
    }
  ]
}
```

### Timezone

All services use **IST (Asia/Kolkata, UTC+5:30)** via `TZ=Asia/Kolkata`.

## API Endpoints

### Auth
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login with JWT
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/mfa/setup` - Setup MFA
- `POST /api/auth/mfa/verify` - Verify TOTP code

### Events
- `GET /api/events/list` - List with pagination
- `GET /api/events/list-enhanced` - Filtered list (type, camera, date range)
- `GET /api/events/:id` - Event details
- `GET /api/events/image/:filename` - Event image
- `DELETE /api/events/:id` - Delete event

### Visitors
- `GET /api/visitors/list` - All visitors
- `GET /api/visitors/timeline` - Visitor timeline
- `GET /api/visitors/:id` - Visitor details
- `PUT /api/visitors/:id` - Update visitor

### Review
- `GET /api/review/segments` - Review segments
- `POST /api/review/segments/:id/dismiss` - Dismiss
- `POST /api/review/segments/:id/confirm` - Confirm

### Detection
- `POST /api/detection/redo` - Re-run detection
- `POST /api/detection/batch` - Batch detection
- `GET /api/detection/status/:jobId` - Job status

### System
- `GET /api/health` - Health check
- `GET /api/stats` - Statistics
- `GET /api/cameras` - Camera list
- `POST /api/cameras/:id/snapshot` - Capture snapshot

## Project Structure

```
home-security-non-docker/
├── frontend/                # React frontend
│   └── src/
│       ├── pages/           # Route pages (Events, Analytics, Settings, DayHighlights...)
│       ├── components/      # UI components
│       │   ├── live/        # Camera grid, stream panels
│       │   ├── events/      # Event detail, filters, timeline
│       │   ├── layout/      # AppLayout, MacDock navigation
│       │   ├── settings/    # Motion/optimization settings
│       │   └── ui/          # shadcn/ui (Radix primitives)
│       ├── services/api/    # API clients (camera, event, detection, auth...)
│       ├── contexts/        # Auth, Camera, Socket contexts
│       └── types/           # TypeScript definitions
├── server/                  # Node.js backend
│   └── src/
│       ├── controllers/     # MVC controllers (Camera, Stream, Auth, Detection...)
│       ├── routes/          # Express route definitions
│       ├── services/        # Business logic (batch, retention, notifications...)
│       ├── models/          # TypeORM entities (User, Event, Visitor, BatchJob...)
│       ├── middleware/      # Auth, validation, rate limiting
│       ├── detection/       # Motion detection (optimized, triggered, consolidated)
│       ├── streams/         # RTSP manager, stream health monitor
│       └── utils/           # Logger, encryption, cron jobs, audit logging
├── opencv-service/          # Python OpenCV service
│   ├── app.py               # Flask application
│   ├── improved_face_recognition.py
│   └── models/              # YOLO weights, face detection models
├── database/
│   └── migrations/          # SQL migrations (001-028)
├── scripts/                 # Utility scripts (deploy, health, backup, diagnose)
└── docker-compose.yml
```

## Commands

```bash
# Development
npm run dev                 # Frontend only (5173)
npm run dev:server          # Backend only (9753)
npm run dev:full            # Both
npm run kill:ports          # Kill processes on 5173, 9753

# Build
npm run build               # Frontend
npm run build:server        # Backend
npm run build:full          # Both

# Testing
npm run lint                # ESLint (frontend)
npm run typecheck           # TypeScript check (frontend)
npm run test                # Jest (frontend)

# Utility scripts
scripts/health.sh           # Service health monitoring
scripts/diagnose.sh         # System diagnostics
scripts/test-opencv.sh      # Test OpenCV + backend + frontend
scripts/backup.sh           # Database and file backups
scripts/deploy.sh           # Production deployment
scripts/sentryvision.sh     # Interactive management console
```

## Database

28 migrations creating tables across 5 domains:

| Category | Tables |
|----------|--------|
| Users | `users`, `roles`, `user_sessions`, `password_history`, `audit_logs` |
| Detection | `events`, `detection_config`, `processed_images`, `adaptive_regions`, `face_embeddings` |
| Visitors | `visitor_timeline`, `timeline`, `unknown_faces` |
| Review | `review_segments`, `user_review_status`, `batch_jobs` |
| System | `retention_policies`, `storage_stats`, `system_settings`, `notification_*`, `security_events`, `rate_limit_counters`, `ai_analysis_results` |

## Security

- JWT access (15 min) / refresh (7 days) tokens
- TOTP MFA (Google Authenticator compatible)
- Role-based access (admin, user, viewer)
- BCrypt password hashing with history tracking
- Zod input validation on all endpoints
- Rate limiting per endpoint
- Helmet.js security headers
- Full audit logging of sensitive operations

## Deployment

See `scripts/deploy.sh` for production deployment. Key steps:

1. Configure `.env` with production secrets (never use defaults)
2. Run `scripts/deploy.sh` or `docker-compose up -d`
3. Set up SSL/TLS reverse proxy
4. Configure PostgreSQL backups
5. Monitor via `scripts/health.sh`

## Documentation

- **`AGENTS.md`** - Developer guidelines, architecture details, conventions
- **`server/cameras.example.json`** - Camera config reference
- **`.env.example`** - Environment variable template

## License

Private project
