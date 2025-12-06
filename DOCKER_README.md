# SentryVision Simple Docker Setup

This is a streamlined Docker configuration for SentryVision that focuses on running the essential services without complexity.

## Quick Start

### Prerequisites
- Docker or Podman with docker-compose/podman-compose
- No database required for basic testing (uses in-memory storage)

### Configuration

The application uses `.env.simple` for basic configuration. You can modify ports and other settings there.

### Running the Application

1. **Start all services:**
   ```bash
   ./start-docker.sh
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:9753
   - Health check: http://localhost:9753/health

### Manual Alternative

If you prefer to run manually:

```bash
# Create necessary directories
mkdir -p server/public/snapshots server/public/events server/logs

# Start services
docker-compose up --build
```

Or with Podman:
```bash
podman-compose up --build
```

### Stopping the Services

Press `Ctrl+C` in the terminal running the start script, or run:
```bash
docker-compose down
```

## What's Included

This simplified setup includes:

1. **Backend Service** (server/Dockerfile)
   - Node.js 18 Alpine
   - Essential dependencies (ffmpeg, curl)
   - Runs on port 9753
   - Uses server-simple.js for basic API functionality

2. **Frontend Service** (root Dockerfile)
   - React app served by nginx
   - Runs on port 3000
   - Proxies API requests to backend

## Key Features

- ✅ No database dependencies for basic testing
- ✅ Minimal system requirements
- ✅ Fast startup time
- ✅ Hot reload support for development
- ✅ Persistent storage for snapshots and events
- ✅ Health checks for both services
- ✅ Proper error handling and logging

## Directory Structure

```
/
├── docker-compose.yml      # Main compose file
├── start-docker.sh        # Startup script
├── .env.simple            # Environment configuration
├── server/
│   ├── Dockerfile         # Backend Dockerfile
│   └── server-simple.js   # Simplified backend server
└── Dockerfile             # Frontend Dockerfile
```

## Customization

### Changing Ports

Edit the `.env.simple` file:

```bash
# In .env.simple
FRONTEND_PORT=YOUR_FRONTEND_PORT
BACKEND_PORT=YOUR_BACKEND_PORT
```

### Adding Environment Variables

You can add environment variables to either service in the compose file:

```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
      - PORT=9753
      - CUSTOM_VAR=value
```

## Troubleshooting

### Port Already in Use

If you get a port conflict, either:
1. Stop the service using the port: `lsof -ti:9753 | xargs kill -9`
2. Change the port in `.env.simple` file

### Permission Issues

If you encounter permission errors with volumes:
```bash
sudo chown -R $USER:$USER server/public/snapshots server/public/events server/logs
```

### Build Failures

If the build fails:
1. Check Docker/Podman is running: `docker info` or `podman info`
2. Clear the build cache: `docker builder prune` or `podman system prune`
3. Check system resources (need at least 2GB RAM available)

## Development

For development with hot reload:

1. Mount the source directories:
   ```yaml
   services:
     backend:
       volumes:
         - ./server/src:/app/src
         - ./server/server-simple.js:/app/server-simple.js
   ```

2. Use nodemon to restart on file changes:
   ```bash
   npm install -g nodemon
   # Update CMD in Dockerfile to: ["nodemon", "server-simple.js"]
   ```

## Production Considerations

This simplified setup is great for testing and development, but for production you may want to:

1. Add a PostgreSQL database
2. Add Redis for caching
3. Implement proper secrets management
4. Add SSL/TLS termination
5. Set up monitoring and logging
6. Configure resource limits

## Next Steps

To upgrade to a full production setup, see:
- `docker-compose.all-services.yml` (full stack with database)
- `.env.docker` (environment configuration)
- `DOCKER_SETUP.md` (comprehensive setup guide)