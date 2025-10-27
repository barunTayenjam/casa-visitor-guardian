# Docker Fixes Summary

## Issues Fixed

### 1. Frontend-Backend Connection Issues
**Problem**: Frontend was hardcoded to connect to localhost URLs even in Docker production mode.

**Solution**: 
- Updated `SocketService.ts` to use `window.location.origin` in production
- Updated `ApiService.ts` to use relative URLs in production
- Added proper nginx proxy configuration for all backend routes

### 2. Missing Proxy Routes
**Problem**: nginx was missing proxy routes for `/events` and `/snapshots` endpoints.

**Solution**: 
- Added proxy configurations for `/events/` and `/snapshots/` in `nginx.conf`
- Created `nginx-manjaro.conf` for the alternative setup

### 3. Health Check Issues
**Problem**: Health checks were using `curl` which isn't available in Alpine nginx images.

**Solution**: 
- Replaced `curl` with `wget` in all health checks
- Added `wget` installation to Dockerfiles

### 4. Port Configuration
**Problem**: Manjaro compose file had hardcoded ports.

**Solution**: 
- Made ports configurable via environment variables
- Created `.env.manjaro` for easy port configuration
- Updated startup script to handle custom ports

### 5. Stream Connection Errors
**Problem**: Socket.IO connections were failing due to incorrect URLs and missing proxy configuration.

**Solution**: 
- Fixed Socket.IO URL resolution in production
- Added proper WebSocket proxy configuration in nginx
- Improved error handling and connection retry logic

## Configuration Simplified

1. **Single `.env`** - Simple configuration with port 3020 for frontend, 9753 for backend
2. **`DOCKER_FIXES_SUMMARY.md`** - This summary document
3. **Updated unified `docker-compose.yml`** - Uses environment variables from .env file

## Updated Files

1. **`nginx.conf`** - Added `/events/` and `/snapshots/` proxy routes
2. **`Dockerfile`** - Added `wget` for health checks, fixed health check command
3. **`docker-compose.yml`** - Fixed health check to use `wget`
4. **`src/services/SocketService.ts`** - Fixed production URL resolution
5. **`src/services/ApiService.ts`** - Fixed image URL generation for production
6. **`start-docker.sh`** - Added support for environment files and custom ports
7. **`README.md`** - Added port configuration documentation
8. **`MANJARO_DOCKER_TROUBLESHOOTING.md`** - Updated with new port configuration options

## How to Use

### Quick Start (Recommended)
```bash
./start-docker.sh
```

### Manual Commands

#### Standard Deployment (Port 3020)
```bash
docker-compose up --build
```

#### Custom Ports
Edit the `.env` file:
```bash
FRONTEND_PORT=3020
NGINX_PORT=3020
BACKEND_PORT=9753
```

Then run:
```bash
docker-compose up --build
```

#### Development Mode (Port 5173)
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Key Improvements

1. **Proper Docker Networking**: Frontend and backend now communicate correctly within Docker network
2. **Flexible Port Configuration**: Easy to change ports without editing compose files
3. **Better Error Handling**: Improved connection retry logic and error messages
4. **Production-Ready**: Proper nginx configuration with all necessary proxy routes
5. **Manjaro-Specific Support**: Dedicated configuration for Manjaro Linux users
6. **Automated Setup**: Smart startup script that detects available ports and chooses best configuration

## Testing

All configurations have been tested and verified:
- ✅ Docker builds complete successfully
- ✅ Health checks pass
- ✅ Nginx proxy routes configured correctly
- ✅ Environment variable substitution works
- ✅ Port configuration is flexible

## Access URLs

- **Standard**: http://localhost:3020
- **Development**: http://localhost:5173

The backend API is accessible at `/api/` on the same domain/port as the frontend.