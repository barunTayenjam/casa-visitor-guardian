# SentryVision

A comprehensive home security system with real-time camera streaming, motion detection, facial recognition, and visitor analytics.

## Features

- **Real-time Camera Streaming**: RTSP stream processing with FFmpeg and WebSocket delivery
- **Motion Detection**: Optimized OpenCV-based MOG2 background subtraction with adaptive sensitivity
- **Object Detection**: Track persons, vehicles (cars), pets (dogs, cats), and packages
- **Facial Recognition**: Face detection and known person matching via Python OpenCV service
- **Visitor Analytics**: Timeline views, review segments, and visitor tracking
- **Multi-camera Support**: Zone-based detection with customizable tracking areas
- **Event Recording**: 24/7 recording with configurable retention policies
- **User Management**: Role-based access control with MFA support
- **System Health Monitoring**: Real-time metrics and performance dashboard

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend      │      │    Backend      │      │  OpenCV Service │
│   (React)       │◄────►│   (Node.js)     │◄────►│   (Python)      │
│   Port: 5173    │      │   Port: 9753    │      │   Port: 8084    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
             ┌──────▼──────┐            ┌──────▼──────┐
             │  PostgreSQL │            │    Redis    │
             │  Port: 5432 │            │  Port: 6379 │
             └─────────────┘            └─────────────┘
```

| Service | Stack | Port |
|---------|-------|------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + Radix UI | 5173 |
| Backend | Node.js + Express + TypeScript + TypeORM + Socket.io | 9753 |
| OpenCV | Python Flask + OpenCV (MOG2 motion detection, YOLO objects, face recognition) | 8084 |
| Database | PostgreSQL 15+ with 17 tables across 8 migrations | 5432 |
| Cache | Redis for detection result caching (with in-memory fallback) | 6379 |

## Quick Start

### Using Docker (Recommended)

```bash
git clone <repository-url> && cd home-security-non-docker
docker-compose up -d
docker-compose ps          # Check service status
docker-compose logs -f     # View logs
```

### Local Development

```bash
npm install && cd server && npm install && cd ../frontend && npm install && cd ../database && npm install

createdb sentryvision     # Create database
cd database && npm run migrate  # Run migrations

npm run dev:full           # Start both frontend and backend
```

### Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:9753 |
| OpenCV Service | http://localhost:8084 |

## Configuration

### Camera Setup

Edit `server/cameras.json` to configure your cameras:

```json
{
  "id": "cam1",
  "name": "Front Door",
  "streams": [{
    "path": "rtsp://user:pass@192.168.1.100:554/stream1",
    "roles": ["live", "detect", "record"],
    "width": 1920,
    "height": 1080,
    "fps": 4
  }],
  "objects": {
    "track": ["person", "car", "dog", "cat", "package"]
  },
  "zones": [
    {
      "id": "front_steps",
      "name": "Front Steps",
      "coordinates": [[0.1, 0.5], [0.4, 0.3], [0.5, 0.4], [0.2, 0.7]],
      "objects": ["person", "package"]
    }
  ]
}
```

### Motion Detection

Optimized MOG2 parameters in `opencv-service/app.py`:

| Parameter | Default | Optimized | Improvement |
|-----------|---------|-----------|-------------|
| History | 500 | 200 | 2.5x faster adaptation |
| varThreshold | 16 | 8 | 2x more sensitive |
| detectShadows | true | false | Reduced noise |
| Motion threshold | 0.3% | 0.2% | Detect smaller motion |
| Contour threshold | 0.2% | 0.15% | Better edge detection |

Backend detection in `server/src/detection/optimizedMotionDetection.ts`:

- Sensitivity: 90/100 (maximum)
- Detection interval: 3 seconds
- Cooldown: 10 seconds between events
- Night mode: Enhanced sensitivity 22:00-06:00

### Timezone

All services configured for **IST (Asia/Kolkata, UTC+5:30)** via `TZ=Asia/Kolkata` in docker-compose.yml.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with JWT
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/mfa/setup` - Setup MFA
- `POST /api/auth/mfa/verify` - Verify MFA code

### Events
- `GET /api/events/list` - List events with pagination
- `GET /api/events/list-enhanced` - Enhanced event list with filters
- `GET /api/events/:id` - Get event details
- `GET /api/events/image/:filename` - Get event image

### Visitors
- `GET /api/visitors/list` - List all visitors
- `GET /api/visitors/timeline` - Get visitor timeline
- `GET /api/visitors/:id` - Get visitor details
- `PUT /api/visitors/:id` - Update visitor info

### Review
- `GET /api/review/segments` - Get review segments
- `POST /api/review/segments/:id/dismiss` - Dismiss segment
- `POST /api/review/segments/:id/confirm` - Confirm detection

### System
- `GET /api/health` - Health check
- `GET /api/stats` - System statistics
- `GET /api/cameras` - List cameras
- `POST /api/cameras/:id/snapshot` - Capture snapshot

## Project Structure

```
home-security-non-docker/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API clients
│   │   ├── hooks/        # Custom React hooks
│   │   ├── types/        # TypeScript definitions
│   │   └── contexts/     # React contexts
│   └── package.json
├── server/               # Node.js backend
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   ├── models/       # TypeORM entities
│   │   ├── middleware/   # Express middleware
│   │   ├── detection/    # Motion detection (3 implementations)
│   │   └── streams/      # RTSP management
│   ├── cameras.json      # Camera configuration
│   └── package.json
├── opencv-service/       # Python OpenCV service
│   ├── app.py           # Flask application
│   ├── improved_face_recognition.py
│   └── models/          # ML models
├── database/            # PostgreSQL setup
│   └── migrations/      # SQL migrations (001-008)
├── scripts/             # Utility scripts (health, diagnose, backup, deploy)
├── AGENTS.md            # Development guidelines (comprehensive)
└── docker-compose.yml   # Multi-service orchestration
```

## Development Scripts

```bash
# Root commands
npm run dev                 # Start frontend only
npm run dev:server          # Start backend only
npm run dev:full            # Start both
npm run build               # Build frontend
npm run build:server        # Build backend
npm run kill:ports          # Kill processes on ports 5173, 9753

# Docker
docker-compose up -d        # Start all services
docker-compose down         # Stop all services
docker-compose logs -f      # View logs

# Utility scripts (in scripts/)
scripts/health.sh           # Service health monitoring
scripts/diagnose.sh         # System diagnostic (cameras, ports, ffmpeg)
scripts/test-opencv.sh [host]  # Test OpenCV + backend + frontend
scripts/backup.sh           # Database and file backups
scripts/deploy.sh           # Production deployment
scripts/sentryvision.sh     # Interactive management console

# Frontend (cd frontend)
npm run typecheck           # TypeScript type checking
npm run lint                # ESLint check
npm test                    # Run Jest tests

# Backend (cd server)
npm run dev                 # Start with hot reload
npm run build               # Compile TypeScript
npm start                   # Start production server

# Database (cd database)
npm run migrate             # Run migrations
```

## Database Schema

17 tables across user management, detection, visitor tracking, review, and system config:

| Category | Tables |
|----------|--------|
| Users | `users`, `roles`, `user_sessions`, `password_history`, `audit_logs` |
| Detection | `events`, `detection_config`, `processed_images`, `adaptive_regions` |
| Visitors | `visitor_timeline`, `timeline` |
| Review | `review_segments`, `user_review_status`, `batch_jobs` |
| System | `retention_policies`, `storage_stats`, `system_settings` |

## Security

- **Authentication**: JWT with access/refresh token pattern (15 min / 7 days)
- **MFA**: TOTP-based (Google Authenticator compatible)
- **Authorization**: Role-based access (admin, user, viewer)
- **Rate Limiting**: Configurable per endpoint
- **Input Validation**: Zod schemas for all API inputs
- **Audit Logging**: Complete trail of sensitive operations
- **Security Headers**: Helmet.js with CSP, X-Frame-Options
- **Password Policies**: Complexity requirements + history tracking

## Testing

```bash
# Frontend
cd frontend && npm test

# Backend
cd server && npm test
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port conflicts | `npm run kill:ports` |
| Database connection | `docker ps \| grep postgres` then `docker exec -it sentryvision-postgres psql -U sentryvision -d sentryvision` |
| OpenCV not responding | `curl http://localhost:8084/health` |
| Motion not detecting | Check RTSP URLs in `cameras.json`, verify FFmpeg, check detection zones |
| Frontend build errors | `rm -rf frontend/node_modules && cd frontend && npm install` |
| Backend TypeScript errors | `cd server && rm -rf dist && npm run build` |

## Documentation

- **`AGENTS.md`** - Comprehensive development guidelines, code conventions, and system details
- **`server/cameras.example.json`** - Camera configuration reference

## License

Private project
