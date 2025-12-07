# SentryVision Docker Deployment Guide

## Overview
This guide covers deploying the complete SentryVision home security system using Docker and Docker Compose.

## Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+, Manjaro, Arch Linux)
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 20GB free space
- **Network**: Stable internet connection for cameras

### Software Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

## Installation

### 1. Install Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Manjaro/Arch Linux
sudo pacman -S docker docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

### 2. Clone Repository
```bash
git clone <your-repo-url>
cd home-security
```

### 3. Configure Environment
The docker-compose.yml file contains all necessary environment variables. Review and modify if needed:

```yaml
# In docker-compose.yml under backend.environment
- DB_PASSWORD=your-secure-password  # Change this!
- JWT_SECRET=your-32-char-secret   # Change this!
```

### 4. Deploy
```bash
# Make deployment script executable
chmod +x deploy-docker.sh

# Run deployment
./deploy-docker.sh
```

Or manually:
```bash
# Create data directories
mkdir -p data/snapshots data/events logs

# Start services
docker compose up --build -d

# Check status
docker compose ps
```

## Services

### Frontend (Nginx)
- **URL**: http://localhost:4000
- **Purpose**: Web interface and camera viewer
- **Container**: `sentryvision_nginx`

### Backend API
- **URL**: http://localhost:8082
- **Purpose**: REST API and WebSocket server
- **Container**: `sentryvision_backend`

### Database (PostgreSQL)
- **Port**: 5432 (internal only)
- **Purpose**: User management, audit logs
- **Container**: `sentryvision_postgres`

### Cache (Redis)
- **Port**: 6379 (internal only)
- **Purpose**: Session storage, caching
- **Container**: `sentryvision_redis`

### OpenCV Service
- **Purpose**: Image processing and AI detection
- **Container**: `sentryvision_opencv`

## Default Credentials

**Initial Login**:
- Username: `admin`
- Password: `admin`

⚠️ **Change immediately after first login!**

## Configuration

### Camera Setup
1. Access http://localhost:4000
2. Navigate to Camera Configuration
3. Add your RTSP camera URLs
4. Test connections

### Environment Variables
Key variables in `docker-compose.yml`:

```yaml
backend:
  environment:
    # Database
    DB_HOST: postgres
    DB_NAME: sentryvision
    DB_USER: sentryvision
    DB_PASSWORD: your-secure-password
    
    # Security
    JWT_SECRET: your-32-character-minimum-secret
    BCRYPT_ROUNDS: 12
    
    # Storage
    MAX_STORAGE_GB: 10
    RETENTION_DAYS: 30
    
    # Performance
    RATE_LIMIT_MAX: 100
    MAX_CONCURRENT_STREAMS: 20
```

### Storage Paths
```bash
data/snapshots/  # Camera snapshots
data/events/      # Motion detection events
logs/             # Application logs
```

## Management

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f nginx
```

### Service Control
```bash
# Stop all services
docker compose down

# Restart specific service
docker compose restart backend

# Update and rebuild
docker compose up --build -d
```

### Database Management
```bash
# Access PostgreSQL
docker compose exec postgres psql -U sentryvision -d sentryvision

# Backup database
docker compose exec postgres pg_dump -U sentryvision sentryvision > backup.sql

# Restore database
docker compose exec -T postgres psql -U sentryvision sentryvision < backup.sql
```

### Storage Management
```bash
# Check storage usage
docker compose exec backend du -sh /app/public/

# Clean old events (older than 30 days)
docker compose exec backend find /app/public/events -name "*.jpg" -mtime +30 -delete
```

## Monitoring

### Health Checks
```bash
# Check service health
docker compose ps

# Backend health
curl http://localhost:8082/api/health

# Frontend health
curl http://localhost:4000/health
```

### Performance Monitoring
```bash
# Resource usage
docker stats

# Disk usage
df -h
docker system df
```

## Troubleshooting

### Common Issues

#### 1. Backend Won't Start
```bash
# Check logs
docker compose logs backend

# Common causes:
# - Port conflicts (ensure 8082 is free)
# - Database connection issues
# - Missing environment variables
```

#### 2. Database Connection Failed
```bash
# Restart database
docker compose restart postgres

# Check database logs
docker compose logs postgres

# Verify database is ready
docker compose exec postgres pg_isready -U sentryvision
```

#### 3. Camera Streams Not Working
```bash
# Check OpenCV service
docker compose logs opencv

# Verify camera URLs in configuration
# Ensure RTSP URLs are accessible from container
```

#### 4. High Memory Usage
```bash
# Check resource limits
docker stats

# Adjust container memory limits in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Reset System
```bash
# Complete reset (removes all data)
docker compose down -v
docker system prune -f
docker volume prune -f

# Then redeploy
./deploy-docker.sh
```

## Security

### Production Hardening

1. **Change Default Passwords**
   - Database password in docker-compose.yml
   - JWT secret (32+ characters)
   - Admin login via web interface

2. **Network Security**
   ```yaml
   # In docker-compose.yml
   services:
     postgres:
       # Remove external port mapping
       # ports: []  # Comment out or remove
   ```

3. **SSL/TLS**
   ```yaml
   nginx:
     environment:
       - SSL_ENABLED=true
       - SSL_CERT_PATH=/etc/ssl/certs/cert.pem
       - SSL_KEY_PATH=/etc/ssl/private/key.pem
   ```

4. **Firewall**
   ```bash
   # Only expose necessary ports
   sudo ufw allow 4000/tcp  # Frontend
   sudo ufw deny 8082/tcp  # Backend (internal only)
   sudo ufw deny 5432/tcp  # Database (internal only)
   ```

## Updates

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up --build -d
```

### Update Docker Images
```bash
# Update base images
docker compose pull

# Rebuild
docker compose up --build -d
```

## Backup and Recovery

### Automated Backup Script
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/sentryvision"

mkdir -p $BACKUP_DIR

# Database backup
docker compose exec -T postgres pg_dump -U sentryvision sentryvision > $BACKUP_DIR/db_$DATE.sql

# Config backup
tar -czf $BACKUP_DIR/config_$DATE.tar.gz docker-compose.yml cameras.json

# Data backup
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/

echo "Backup completed: $BACKUP_DIR"
```

### Recovery
```bash
# Restore database
docker compose exec -T postgres psql -U sentryvision sentryvision < backup.sql

# Restore data
tar -xzf data_backup.tar.gz
```

## Support

### Log Locations
- **Application logs**: `docker compose logs backend`
- **Nginx logs**: `docker compose logs nginx`
- **Database logs**: `docker compose logs postgres`

### Debug Mode
Enable debug logging by setting:
```yaml
backend:
  environment:
    - LOG_LEVEL=debug
```

### Performance Tuning
- Adjust `MAX_CONCURRENT_STREAMS` based on your hardware
- Increase `RATE_LIMIT_MAX` for busy environments
- Tune PostgreSQL settings in docker-compose.yml

## API Documentation

Once deployed, API documentation is available at:
- Swagger UI: http://localhost:8082/api/docs
- Health Check: http://localhost:8082/api/health

## Conclusion

Your SentryVision system is now running in Docker containers with:
- ✅ Complete web interface
- ✅ REST API with authentication
- ✅ Real-time camera streaming
- ✅ Motion detection
- ✅ Database persistence
- ✅ Automatic backups and cleanup

For issues or questions, check the logs and troubleshooting section above.