# SentryVision Docker Setup Guide

This guide will help you set up and run SentryVision using Docker containers with all three microservices (frontend, backend, database) running together.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)
- At least 4GB of available RAM
- 10GB of free disk space

## Quick Start

### 1. Clone and Navigate to Project

```bash
cd /path/to/sentryvision
```

### 2. Configure Environment

Copy and configure the environment file:

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` with your configuration:

```bash
nano .env.docker
```

**Important**: Change all default passwords and secrets for production use!

### 3. Start All Services

Run the startup script:

```bash
./start-docker.sh
```

This will:
- Check Docker and Docker Compose availability
- Generate secure passwords and secrets if needed
- Create necessary directories
- Start all services (PostgreSQL, Redis, Backend, Frontend)
- Wait for services to be healthy
- Display access URLs

### 4. Access SentryVision

Once running, you can access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9753
- **OpenCV Service**: http://localhost:9754
- **Database**: localhost:5432
- **Redis**: localhost:6379

## Services Overview

### Core Services

1. **PostgreSQL Database** (`postgres`)
   - Port: 5432
   - Database: `sentryvision`
   - User: `sentryvision`
   - Persistent data in Docker volume

2. **Redis Cache** (`redis`)
   - Port: 6379
   - Used for session management and caching
   - Persistent data in Docker volume

3. **Backend API** (`backend`)
   - Port: 9753
   - Node.js/Express application
   - Handles authentication, streaming, and API requests

4. **Frontend** (`frontend`)
   - Port: 3000
   - React/TypeScript application
   - Served by nginx

5. **OpenCV Service** (`opencv-service`)
   - Port: 9754
   - AI/ML processing service
   - Handles motion detection, facial recognition, and image processing

### Optional Services

6. **Nginx Reverse Proxy** (`nginx`)
   - Ports: 80, 443
   - Production reverse proxy with SSL termination
   - Use `--profile production` to enable

## Management Commands

The `start-docker.sh` script provides several commands:

### Start Services
```bash
./start-docker.sh start
# or simply
./start-docker.sh
```

### Stop Services
```bash
./start-docker.sh stop
```

### Restart Services
```bash
./start-docker.sh restart
```

### Check Status
```bash
./start-docker.sh status
```

### View Logs
```bash
./start-docker.sh logs
```

### Clean Up
```bash
./start-docker.sh cleanup
```

### Help
```bash
./start-docker.sh help
```

## Manual Docker Commands

If you prefer to use Docker Compose directly:

### Start All Services
```bash
docker compose --env-file .env.docker -f docker-compose.all-services.yml up -d
```

### Stop All Services
```bash
docker compose --env-file .env.docker -f docker-compose.all-services.yml down
```

### View Logs
```bash
docker compose --env-file .env.docker -f docker-compose.all-services.yml logs -f
```

### View Specific Service Logs
```bash
docker compose --env-file .env.docker -f docker-compose.all-services.yml logs -f backend
```

## Environment Configuration

### Required Variables

- `DB_PASSWORD`: PostgreSQL database password
- `REDIS_PASSWORD`: Redis password
- `JWT_ACCESS_SECRET`: JWT access token secret
- `JWT_REFRESH_SECRET`: JWT refresh token secret
- `TOTP_SECRET`: TOTP authentication secret

### Optional Variables

- `FRONTEND_PORT`: Frontend port (default: 3000)
- `BACKEND_PORT`: Backend port (default: 9753)
- `OPENCV_PORT`: OpenCV service port (default: 9754)
- `DB_PORT`: Database port (default: 5432)
- `REDIS_PORT`: Redis port (default: 6379)

### Port Configuration

Default port mapping:
- Frontend: 3000 → 3000
- Backend: 9753 → 9753
- OpenCV Service: 9754 → 9754
- Database: 5432 → 5432
- Redis: 6379 → 6379

## Data Persistence

Docker volumes are used for persistent data:

- `postgres_data`: PostgreSQL database files
- `redis_data`: Redis cache data
- `backend_snapshots`: Camera snapshots
- `backend_events`: Security events
- `frontend_build`: Built frontend assets
- `opencv_models`: OpenCV ML models and data

Local directories are also mounted:
- `./logs/`: Application logs
- `./data/`: Uploads and media files

## Development vs Production

### Development Mode
```bash
./start-docker.sh start
```

Uses development configuration with:
- Hot reloading enabled
- Debug logging
- Less strict security settings

### Production Mode
```bash
docker compose --env-file .env.docker -f docker-compose.all-services.yml --profile production up -d
```

Enables:
- Nginx reverse proxy
- SSL termination
- Production optimizations
- Enhanced security headers

## Troubleshooting

### Common Issues

1. **Port Conflicts**
```bash
# Check what's using ports
lsof -i :3000
lsof -i :9753
lsof -i :9754
lsof -i :5432

# Kill processes if needed
./start-docker.sh stop
```

2. **Permission Issues**
   ```bash
   # Fix script permissions
   chmod +x start-docker.sh
   
   # Fix directory permissions
   sudo chown -R $USER:$USER data/ logs/
   ```

3. **Docker Not Running**
   ```bash
   # Start Docker Desktop
   # or check Docker daemon
   docker info
   ```

4. **Out of Memory**
   - Increase Docker Desktop memory allocation to 4GB+
   - Stop unused containers

5. **Database Connection Issues**
   ```bash
   # Check database logs
   docker compose logs postgres
   
   # Restart database
   docker compose restart postgres
   ```

### Health Checks

All services include health checks:

```bash
# Check service health
docker compose ps

# Check specific service
docker compose exec backend curl http://localhost:9753/api/health
docker compose exec opencv-service curl http://localhost:9754/health
docker compose exec postgres pg_isready -U sentryvision -d sentryvision
docker compose exec redis redis-cli ping
```

### Logs

View logs for troubleshooting:

```bash
# All services
./start-docker.sh logs

# Specific service
docker compose logs backend
docker compose logs frontend
docker compose logs opencv-service
docker compose logs postgres
docker compose logs redis
```

## Security Considerations

1. **Change Default Passwords**: Always change default passwords in `.env.docker`
2. **Network Security**: Services communicate within Docker network
3. **Volume Permissions**: Ensure proper file permissions on mounted volumes
4. **Secrets Management**: Use proper secret management in production
5. **SSL/TLS**: Enable SSL in production using nginx profile

## Performance Optimization

1. **Resource Limits**: Configure Docker Desktop memory and CPU limits
2. **Database Tuning**: PostgreSQL is pre-configured for performance
3. **Redis Configuration**: Redis is configured with memory limits
4. **Nginx Caching**: Static assets are cached aggressively

## Backup and Recovery

### Database Backup
```bash
# Create backup
docker compose exec postgres pg_dump -U sentryvision sentryvision > backup.sql

# Restore backup
docker compose exec -T postgres psql -U sentryvision sentryvision < backup.sql
```

### Volume Backup
```bash
# Backup volumes
docker run --rm -v sentryvision_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

## Next Steps

1. **Configure Cameras**: Set up your camera configurations
2. **Create Admin User**: Create initial admin account
3. **Test Features**: Verify motion detection and streaming
4. **Set Up Monitoring**: Configure monitoring and alerts
5. **Configure SSL**: Set up SSL certificates for production

## Support

For issues and questions:
1. Check the logs using `./start-docker.sh logs`
2. Verify service status with `./start-docker.sh status`
3. Review environment configuration in `.env.docker`
4. Check Docker Desktop for resource issues

## Advanced Usage

### Custom Networks
Services use a custom network `sentryvision-network` with subnet `172.20.0.0/16`.

### Service Dependencies
Services have proper dependency management:
- Backend waits for database, redis, and opencv-service
- OpenCV service waits for redis and backend
- Frontend waits for backend
- Nginx waits for frontend and backend

### Scaling
For production scaling, consider:
- Load balancer configuration
- Database replication
- Redis clustering
- Container orchestration (Kubernetes)