# Simple Docker Development Setup

A lightweight Docker implementation for SentryVision development with hot-reload and minimal image sizes.

## Architecture

- **Frontend**: React/Vite (port 5173) - `node:20-alpine` (~120MB)
- **Backend**: Node.js/Express (port 8082) - `node:20-alpine` (~140MB)
- **OpenCV**: Python/Flask (port 8084) - `python:3.11-slim` (~180MB)
- **PostgreSQL**: Database - `postgres:15-alpine` (~230MB)
- **Redis**: Cache - `redis:7-alpine` (~32MB)

**Total image size**: ~700MB (optimized for development)

## Features

- ✅ Source code mounted for hot-reload development
- ✅ Shared data volume across all services
- ✅ Minimal base images (alpine/slim variants)
- ✅ Proper signal handling with dumb-init
- ✅ Health checks for all services
- ✅ Development-optimized Dockerfiles

## Quick Start

```bash
# Start all services in development mode
npm run docker:dev

# Start in detached mode
npm run docker:dev:detach

# View logs
npm run docker:dev:logs

# Stop all services
npm run docker:dev:down

# Restart services
npm run docker:dev:restart

# Check running containers
npm run docker:ps
```

## Volume Structure

```
./data/                    # Shared data (events, snapshots, uploads, cache, logs)
├── events/
├── snapshots/
├── uploads/
├── cache/
└── logs/

./server/models/           # YOLO models (read-only for OpenCV)
./public/                  # Public assets and temp files
```

## Service Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8082
- **OpenCV Service**: http://localhost:8084
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Development Workflow

1. **Code changes**: Automatically hot-reloaded via volume mounts
2. **Node modules**: Installed inside containers, not overridden
3. **Data persistence**: Stored in Docker volumes and shared data directory
4. **Database**: PostgreSQL data persisted in `postgres_data` volume

## Troubleshooting

### Services not starting
```bash
# Check logs
npm run docker:dev:logs

# Restart specific service
docker-compose -f docker-compose.dev.yml restart backend
```

### Port conflicts
Ensure ports 5173, 8082, 8084, 5432, and 6379 are available:
```bash
npm run kill:ports
```

### Clean rebuild
```bash
# Remove all containers and volumes
npm run docker:clean

# Rebuild from scratch
npm run docker:dev
```

## Individual Service Control

```bash
# Start only backend
cd server && npm run docker:dev

# Start only frontend
cd frontend && npm run docker:dev

# Start only OpenCV
cd opencv-service && docker build -f Dockerfile.dev -t sentryvision-opencv .
```

## Environment Variables

All services use development environment variables defined in `docker-compose.dev.yml`. Key variables:

- `NODE_ENV=development`
- `DATABASE_URL=postgresql://...`
- `OPENCV_SERVICE_URL=http://opencv:8084`
- `REDIS_HOST=redis`

## Production Deployment

For production, use the existing Dockerfiles:
- `frontend/Dockerfile` - Production build with nginx
- `server/Dockerfile` - Multi-stage production build
- `opencv-service/Dockerfile.python` - Production Python service

## Image Sizes Comparison

| Service | Dev Image | Prod Image |
|---------|-----------|------------|
| Frontend | ~120MB | ~30MB (nginx alpine) |
| Backend | ~140MB | ~120MB |
| OpenCV | ~180MB | ~180MB |
| **Total** | ~700MB | ~560MB |

## Next Steps

- Add docker-compose.prod.yml for production
- Implement Docker secrets for sensitive data
- Add production nginx configuration
- Set up CI/CD pipeline
