# SentryVision Docker Deployment Guide

This guide provides comprehensive instructions for deploying SentryVision using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- At least 4GB RAM available for containers
- 10GB free disk space

## Quick Start

### 1. Start Docker

**macOS:**
```bash
# Open Docker Desktop application
# OR if using Colima:
colima start
```

**Linux:**
```bash
sudo systemctl start docker
```

### 2. Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9753
- **PostgreSQL**: localhost:5432 (internal)
- **Redis**: localhost:6379 (internal)

## Configuration Files

### Development Deployment
```bash
docker-compose.yml        # Development configuration
```

### Production Deployment
```bash
docker-compose.prod.yml   # Production with monitoring
```

## Environment Variables

Create a `.env` file in the root directory (or use the existing one):

```bash
# Service Ports
FRONTEND_PORT=3000
BACKEND_PORT=9753

# Database
DB_HOST=postgres
DB_NAME=sentryvision
DB_USER=sentryvision
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=redis
REDIS_PASSWORD=your_secure_password

# Security (CHANGE THESE!)
JWT_ACCESS_SECRET=change_this_in_production
JWT_REFRESH_SECRET=change_this_in_production
TOTP_SECRET=change_this_in_production
```

## Service Architecture

### Services

1. **Frontend (Nginx + React)**
   - Port: 3000
   - Built with Vite
   - Optimized production build
   - Gzip compression enabled

2. **Backend (Node.js)**
   - Port: 9753
   - Express API server
   - Socket.io for real-time streaming
   - OpenCV for motion detection

3. **PostgreSQL**
   - Port: 5432 (internal)
   - Persistent data storage
   - User management & audit logs

4. **Redis**
   - Port: 6379 (internal)
   - Session storage
   - Caching layer

## Docker Commands

### Basic Operations

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f [service_name]

# Restart a service
docker-compose restart [service_name]

# Rebuild a service
docker-compose build [service_name]

# View service status
docker-compose ps
```

### Troubleshooting Commands

```bash
# View backend logs
docker-compose logs -f backend

# View frontend logs
docker-compose logs -f frontend

# Access backend shell
docker-compose exec backend sh

# Check service health
docker-compose ps

# Restart all services
docker-compose restart

# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Operations

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U sentryvision -d sentryvision

# Backup database
docker-compose exec postgres pg_dump -U sentryvision sentryvision > backup.sql

# Restore database
docker-compose exec -T postgres psql -U sentryvision sentryvision < backup.sql
```

## Volume Management

### Persistent Data

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect home-security_postgres_data

# Backup volume
docker run --rm -v home-security_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Remove volumes (WARNING: This deletes data!)
docker-compose down -v
```

## Network Configuration

Services communicate through a private Docker network:
- Network name: `sentryvision-network`
- Subnet: `172.21.0.0/16`

## Health Checks

All services include health checks:

```bash
# Check backend health
curl http://localhost:9753/health

# Check frontend health
curl http://localhost:3000/health

# Check database health
docker-compose exec postgres pg_isready
```

## Production Deployment

For production, use the production compose file:

```bash
# Start with production configuration
docker-compose -f docker-compose.prod.yml up -d

# This includes:
# - Nginx reverse proxy
# - Prometheus monitoring
# - Grafana dashboards
# - Resource limits
# - SSL/TLS support
```

## Security Best Practices

### 1. Change Default Passwords

Edit `.env` and change all default passwords:
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

### 2. Use Secrets Management

For production, use Docker secrets:

```bash
echo "my_secure_password" | docker secret create db_password -
```

### 3. Enable SSL/TLS

Place SSL certificates in `./docker/ssl/` directory.

### 4. Limit Resource Usage

Resource limits are defined in docker-compose files:
- Backend: 1 CPU, 1GB RAM
- Frontend: 0.5 CPU, 256MB RAM

## Monitoring

### View Resource Usage

```bash
# All containers
docker stats

# Specific container
docker stats sentryvision-backend
```

### Application Logs

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# All logs
docker-compose logs -f
```

## Backup and Restore

### Full Backup

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup database
docker-compose exec postgres pg_dump -U sentryvision sentryvision > backups/$(date +%Y%m%d)/database.sql

# Backup volumes
docker run --rm -v home-security_postgres_data:/data -v $(pwd)/backups/$(date +%Y%m%d):/backup alpine tar czf /backup/postgres_data.tar.gz /data
docker run --rm -v home-security_redis_data:/data -v $(pwd)/backups/$(date +%Y%m%d):/backup alpine tar czf /backup/redis_data.tar.gz /data
```

### Restore

```bash
# Restore database
docker-compose exec -T postgres psql -U sentryvision sentryvision < backups/20250101/database.sql

# Restore volumes
docker run --rm -v home-security_postgres_data:/data -v $(pwd)/backups/20250101:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /
```

## Troubleshooting

### Services Won't Start

1. Check Docker is running: `docker info`
2. Check logs: `docker-compose logs`
3. Check ports aren't in use: `lsof -i :9753` and `lsof -i :3000`

### Backend Connection Issues

1. Check backend health: `curl http://localhost:9753/health`
2. Check backend logs: `docker-compose logs backend`
3. Verify database connection: `docker-compose logs postgres`

### Frontend Not Loading

1. Check frontend health: `curl http://localhost:3000/health`
2. Check frontend logs: `docker-compose logs frontend`
3. Verify backend connectivity from frontend container

### Database Connection Errors

1. Check PostgreSQL is running: `docker-compose ps postgres`
2. Check database logs: `docker-compose logs postgres`
3. Verify credentials in `.env` file

### Performance Issues

1. Check resource usage: `docker stats`
2. Increase resource limits in docker-compose.yml
3. Check disk space: `df -h`

## Updating

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Update Base Images

```bash
# Pull latest base images
docker-compose pull

# Rebuild services
docker-compose build --pull

# Restart
docker-compose up -d
```

## Clean Up

### Remove Everything

```bash
# Stop and remove containers, networks
docker-compose down

# Also remove volumes (WARNING: Deletes data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

### Prune Unused Resources

```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a
```

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review this guide
- Check Docker documentation: https://docs.docker.com
- Check project issues: https://github.com/your-repo/issues
