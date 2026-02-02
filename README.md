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

### Components

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Radix UI
- **Backend**: Node.js + Express + TypeScript + TypeORM + Socket.io
- **Database**: PostgreSQL with 17 tables
- **OpenCV Service**: Python Flask with native OpenCV for AI detection
- **Cache**: Redis for session management and caching

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS + Radix UI components (shadcn/ui)
- **Routing**: React Router v6
- **State Management**: React Query + Context API
- **Real-time**: Socket.io client
- **Charts**: Recharts for analytics

### Backend
- **Runtime**: Node.js with ES modules
- **Framework**: Express
- **Language**: TypeScript (strict mode)
- **ORM**: TypeORM
- **Authentication**: JWT with refresh tokens + TOTP MFA
- **Validation**: Zod schemas
- **Real-time**: Socket.io server
- **Stream Processing**: FFmpeg for RTSP handling

### Database
- **Engine**: PostgreSQL 15+
- **Migrations**: 8 migration files
- **Tables**: 17 tables including users, events, visitors, batch_jobs, review_segments

### AI/ML
- **Motion Detection**: OpenCV MOG2 background subtraction
- **Object Detection**: YOLO-based classification
- **Face Recognition**: Face embeddings with known person matching

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 15+
- Python 3.10+ with OpenCV

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd home-security-non-docker

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

Services will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:9753
- OpenCV Service: http://localhost:8084
- Database: localhost:5432
- Redis: localhost:6379

### Local Development

```bash
# Install dependencies
npm install
cd server && npm install
cd ../frontend && npm install
cd ../database && npm install

# Start PostgreSQL (if not using Docker)
createdb sentryvision

# Run database migrations
cd database
npm run migrate

# Start backend (from root)
npm run dev:server

# Start frontend (from root)
npm run dev

# Or start both concurrently
npm run dev:full
```

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

### Motion Detection Settings

Optimized MOG2 parameters in `opencv-service/app.py`:

- **History**: 200 frames (fast adaptation)
- **Variance Threshold**: 8 (2x more sensitive)
- **Shadow Detection**: Disabled (reduces noise)
- **Motion Threshold**: 0.2% of frame area
- **Contour Threshold**: 0.15% of frame area

Backend detection settings in `server/src/detection/optimizedMotionDetection.ts`:

- **Sensitivity**: 90/100 (maximum)
- **Detection Interval**: 3 seconds
- **Cooldown**: 10 seconds between events
- **Min Confidence**: 5% (very low threshold)
- **Night Mode**: Enhanced sensitivity 22:00-06:00

## Database Schema

Key tables:

- **users**: User accounts with roles and MFA
- **roles**: Role definitions (admin, user, viewer)
- **events**: Motion events with detection data
- **visitor_timeline**: Visitor tracking with known faces
- **review_segments**: Bundled review periods with severity
- **adaptive_regions**: Spatial detection zones
- **batch_jobs**: Async processing job tracking
- **user_sessions**: JWT session management
- **audit_logs**: Security audit trail

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

## Development

### Project Structure

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
│   │   ├── detection/    # Motion detection
│   │   └── streams/      # RTSP management
│   ├── cameras.json      # Camera configuration
│   └── package.json
├── opencv-service/       # Python OpenCV service
│   ├── app.py           # Flask application
│   ├── improved_face_recognition.py
│   └── models/          # ML models
├── database/            # PostgreSQL setup
│   └── migrations/      # SQL migrations (8 files)
├── docs/                # Documentation
└── docker-compose.yml   # Multi-service setup
```

### Detection Services

Three motion detection implementations are active:

1. **optimizedMotionDetection.ts** (988 lines)
   - Main detection with adaptive intervals
   - Used by: index.ts, rtspManager.ts, cleanupService.ts

2. **simpleMotionDetection.ts** (138 lines)
   - Basic detection for event queue
   - Used by: eventQueueService.ts

3. **motionTriggeredDetection.ts** (664 lines)
   - Motion-triggered object/face detection
   - Used by: rtspManager.ts, motionBatchIntegration.ts

### Scripts

```bash
# Frontend
npm run dev              # Start dev server
npm run build            # Build for production
npm run typecheck        # Type checking
npm run lint             # Lint code
npm run test             # Run tests

# Backend
cd server
npm run dev              # Start with hot reload
npm run build            # Compile TypeScript
npm start                # Start production server

# Database
cd database
npm run migrate          # Run migrations

# Docker
npm run docker:dev       # Start development containers
npm run docker:dev:logs  # View logs
npm run docker:clean     # Remove containers and volumes
```

## Timezone Configuration

All services are configured for **IST (Asia/Kolkata, UTC+5:30)**:

```yaml
# docker-compose.yml
environment:
  - TZ=Asia/Kolkata
```

Database timezone:
```sql
ALTER DATABASE sentryvision SET timezone TO 'Asia/Kolkata';
```

## Motion Detection Optimization

The system uses optimized MOG2 parameters for better sensitivity:

| Parameter | Default | Optimized | Improvement |
|-----------|---------|-----------|-------------|
| History | 500 | 200 | 2.5x faster adaptation |
| varThreshold | 16 | 8 | 2x more sensitive |
| detectShadows | true | false | Reduced noise |
| Motion threshold | 0.3% | 0.2% | Detect smaller motion |
| Contour threshold | 0.2% | 0.15% | Better edge detection |

**Expected improvement**: 2-4x better motion detection sensitivity

## Security

- **Authentication**: JWT with access/refresh token pattern
- **MFA Support**: TOTP-based (Google Authenticator compatible)
- **Role-Based Access**: admin, user, viewer roles
- **Rate Limiting**: Configurable per endpoint
- **Input Validation**: Zod schemas for all requests
- **Audit Logging**: Complete trail of sensitive operations
- **CORS**: Configured for specific domains
- **Helmet.js**: Security headers
- **Password Policies**: Complexity requirements + history tracking

## Testing

### Frontend Tests
```bash
cd frontend
npm test                    # Run tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### Backend Tests
```bash
cd server
npm test                    # Run all tests
```

## Troubleshooting

### Port Conflicts
```bash
# Kill processes on ports
npm run kill:ports
```

### Database Connection
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -it sentryvision-postgres psql -U sentryvision -d sentryvision
```

### OpenCV Service
```bash
# Check OpenCV service health
curl http://localhost:8084/health

# View logs
docker logs sentryvision-opencv
```

### Motion Detection Not Working
1. Verify RTSP URLs in cameras.json
2. Check FFmpeg is installed
3. Review OpenCV service logs
4. Ensure detection zones are configured
5. Check sensitivity settings

## Current Status

- **Services**: 5 containers running
- **Cameras**: 2 RTSP cameras (Front Door, Back Door)
- **Events**: 1,050+ events recorded
- **Database**: 17 tables, all migrations applied
- **Timezone**: IST (Asia/Kolkata)
- **Simulation Mode**: Disabled (real detection only)

## License

Private project

## Support

For issues and questions, please refer to `AGENTS.md` for development guidelines.
