# Unused Docker Files

These Docker files were moved here to avoid confusion. The project now uses a simplified setup with:

- `docker-compose.yml` - Main configuration (uses Dockerfile.monolithic)
- `Dockerfile.monolithic` - Complete monolithic setup with OpenCV

## Files in this directory:

### Docker Compose Files
- `docker-compose.complete.yml` - Alternative complete setup
- `docker-compose.full-linux.yml` - Linux-specific full setup
- `docker-compose.host-network.yml` - Host networking configuration
- `docker-compose.simple-core.yml` - Minimal core setup
- `docker-compose.simple-monolithic.yml` - Simple monolithic setup
- `docker-compose.streaming-simple.yml` - Streaming-focused setup
- `docker-compose.ultra-simple.yml` - Ultra-minimal setup

### Dockerfiles
- `Dockerfile.complete` - Complete multi-service setup
- `Dockerfile.full-linux` - Full Linux dependencies
- `Dockerfile.monolithic` - Monolithic setup (MOVED BACK to main)
- `Dockerfile.simple-core` - Simple core services
- `Dockerfile.simple-monolithic` - Simple monolithic setup
- `Dockerfile.streaming-minimal` - Minimal streaming setup
- `Dockerfile.streaming-simple` - Simple streaming setup
- `Dockerfile.ultra-simple` - Ultra-minimal setup

## Current Working Setup

The project now uses:
- `docker-compose.yml` (main)
- `Dockerfile.monolithic` (moved back to root for the working setup)

All other configurations are preserved here for reference if needed.