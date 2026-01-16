# SentryVision Development Environment

This guide explains how to set up and run the SentryVision home security system in development mode using Docker.

## Quick Start

```bash
# Start all services
./dev.sh up

# View logs
./dev.sh logs -f

# Check status
./dev.sh status

# Stop everything
./dev.sh down
```

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React development server |
| Backend API | http://localhost:9753 | Node.js API server |
| OpenCV Service | http://localhost:8084 | Python detection service |
| Database | localhost:5432 | PostgreSQL |
| Redis | localhost:6379 | Redis cache |

## Development Features

### Hot Reload

- **Frontend**: Vite HMR - Changes reflect immediately
- **Backend**: tsx watch mode - Auto-restarts on file changes
- **OpenCV**: Flask debug mode - Auto-reloads on code changes

### Volume Mounts

All source directories are mounted into containers:
- `./server` → `/app` (backend)
- `./frontend` → `/app` (frontend)
- `./opencv-service` → `/app` (Python service)
- `./data` → `/app/data` (detections, events, snapshots)

### Health Checks

Each service includes a health endpoint:
- Backend: `GET /api/health`
- OpenCV: `GET /health`

Docker uses these for service orchestration.

## Manual Commands

If you prefer not to use the dev.sh script:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Restart a specific service
docker compose restart backend

# Rebuild and restart
docker compose up -d --build backend

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Configuration

### Environment Variables

Key environment variables are configured in `docker-compose.yml`:

```yaml
# Backend
NODE_ENV=development
PORT=9753
OPENCV_SERVICE_URL=http://opencv:8084

# OpenCV
FLASK_ENV=development
FLASK_DEBUG=1

# Frontend
VITE_API_URL=http://localhost:9753
```

### Camera Configuration

Cameras are configured in `server/cameras.json`:

```json
[
  {
    "id": "cam1",
    "name": "Front Door",
    "enabled": true,
    "streams": [
      {
        "path": "rtsp://192.168.31.62:554/stream1",
        "roles": ["detect", "record", "live"]
      }
    ],
    "detect": {
      "width": 640,
      "height": 360,
      "fps": 5
    },
    "zones": [...],
    "objects": {
      "track": ["person", "car", "dog", "cat"]
    }
  }
]
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using a port
lsof -i :9753

# Kill the process
kill <PID>
```

### Containers Not Starting

```bash
# Check logs for errors
docker compose logs backend

# Rebuild from scratch
docker compose down -v
docker compose up -d --build
```

### Database Connection Issues

```bash
# Check PostgreSQL is healthy
docker compose ps postgres
docker exec -it sentryvision-postgres psql -U sentryvision -d sentryvision
```

### Camera Stream Issues

Ensure your cameras support RTSP and are accessible from the Docker network. Check the backend logs:

```bash
docker compose logs backend | grep -i rtsp
```

## Development Tips

1. **Use the dev.sh script** for common operations
2. **Check logs frequently** during development
3. **Use `docker compose restart <service>`** after code changes (backend auto-reloads)
4. **Configure zones and filters** via the API or `cameras.json`
5. **MQTT integration** is available but requires a broker (set `MQTT_ENABLED=true`)

## Production Deployment

For production deployment, see `AGENTS.md` and use:
- Production Docker images (not dev mode)
- Environment-specific configuration
- Proper secrets management
