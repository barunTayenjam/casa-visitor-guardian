# SentryVision Containerization Documentation

## Overview

This document describes the containerization setup for SentryVision, a comprehensive home security system. The containerization provides a consistent, scalable, and maintainable deployment environment using Docker and Docker Compose.

## Architecture

The SentryVision application is containerized using a multi-service architecture:

- **Frontend**: React application served by Nginx
- **Backend**: Node.js/Express API server
- **Database**: PostgreSQL for persistent data storage
- **Cache**: Redis for session management and caching
- **Monitoring**: Optional Prometheus and Grafana stack

## Docker Images

### Frontend Dockerfile (`Dockerfile`)

Multi-stage build optimized for production:

1. **Base Stage**: Common dependencies and configuration
2. **Dependencies Stage**: Install npm dependencies
3. **Builder Stage**: Build the React application
4. **Production Stage**: Nginx server with built assets

Key features:
- Uses Node.js 20 Alpine for smaller image size
- Implements proper caching strategies
- Includes security headers and gzip compression
- Supports environment variable substitution
- Health checks for monitoring

### Backend Dockerfile (`server/Dockerfile`)

Multi-stage build for the Node.js backend:

1. **Base Stage**: System dependencies (FFmpeg, Python, etc.)
2. **Dependencies Stage**: Install npm dependencies
3. **Builder Stage**: Compile TypeScript
4. **Production Stage**: Runtime environment

Key features:
- Non-root user for security
- FFmpeg for video processing
- Proper volume mounting for persistent data
- Health checks and graceful shutdown
- Optimized for production workloads

## Docker Compose Configurations

### Main Configuration (`docker-compose.yml`)

Production-ready configuration with:
- All core services (frontend, backend, postgres, redis)
- Proper networking and service discovery
- Health checks for all services
- Persistent volumes for data
- Environment variable configuration
- Resource limits and restart policies

### Development Configuration (`docker-compose.dev.yml`)

Development-specific features:
- Hot reloading with volume mounts
- Development ports exposed
- Debug logging enabled
- Optional admin tools (pgAdmin, Redis Commander)
- Separate development database

### Production Configuration (`docker-compose.prod.yml`)

Production optimizations:
- Nginx reverse proxy
- SSL/TLS termination
- Monitoring stack (Prometheus, Grafana)
- Log aggregation (Elasticsearch, Kibana)
- Performance tuning
- Security hardening

## Environment Configuration

### Required Environment Variables

Core application settings:
```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sentryvision
DB_USER=sentryvision
DB_PASSWORD=your-secure-password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Security
JWT_ACCESS_SECRET=your-32-character-secret
JWT_REFRESH_SECRET=your-32-character-secret
TOTP_SECRET=your-totp-secret
BACKUP_CODE_ENCRYPTION_KEY=your-encryption-key
AUDIT_INTEGRITY_SECRET=your-audit-secret
```

### Optional Environment Variables

Advanced configuration:
```bash
# Performance
MAX_FILE_SIZE=100MB
LOG_LEVEL=info
NODE_ENV=production

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30

# Features
FACIAL_RECOGNITION_ENABLED=true
MOTION_DETECTION_SENSITIVITY=0.5
```

## Deployment

### Quick Start

1. **Environment Setup**:
   ```bash
   cp .env.example .env.production
   # Edit .env.production with your configuration
   ```

2. **Deploy**:
   ```bash
   ./scripts/deploy.sh deploy
   ```

3. **Access**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:9753
   - Admin: admin/admin123 (change immediately)

### Development Setup

1. **Start Development Environment**:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **With Admin Tools**:
   ```bash
   docker-compose -f docker-compose.dev.yml --profile admin up -d
   ```

### Production Deployment

1. **Full Production Deployment**:
   ```bash
   ./scripts/deploy.sh deploy
   ```

2. **With Monitoring**:
   ```bash
   docker-compose -f docker-compose.prod.yml --profile monitoring up -d
   ```

## Health Monitoring

### Health Check Script

Comprehensive health monitoring:
```bash
./scripts/health-check.sh
```

Features:
- Container status monitoring
- Service dependency checks
- Resource usage tracking
- Network connectivity validation
- Log analysis for troubleshooting

### Health Check Commands

```bash
# Full health check
./scripts/health-check.sh

# Service logs
./scripts/health-check.sh logs backend

# Resource usage
./scripts/health-check.sh stats

# Disk space
./scripts/health-check.sh disk

# Network connectivity
./scripts/health-check.sh network
```

## Volumes and Persistence

### Data Volumes

- `postgres_data`: PostgreSQL database files
- `redis_data`: Redis cache data
- `backend_snapshots`: Camera snapshot images
- `backend_events`: Security event data
- `backend_logs`: Application logs

### Backup Strategy

1. **Database Backups**:
   ```bash
   ./scripts/backup-database.sh
   ```

2. **File Backups**:
   ```bash
   ./scripts/backup-files.sh
   ```

3. **Automated Backups**:
   - Database: Daily retention for 30 days
   - Files: Weekly retention for 7 days

## Networking

### Service Communication

- All services communicate through internal Docker network
- Frontend proxies API requests to backend
- Backend connects to database and Redis
- External access only through defined ports

### Port Configuration

- Frontend: 3000 (production), 5173 (development)
- Backend: 9753
- PostgreSQL: 5432 (development only)
- Redis: 6379 (development only)
- Nginx: 80, 443 (production with SSL)

## Security

### Container Security

- Non-root users for all containers
- Minimal base images (Alpine Linux)
- Security scanning in CI/CD pipeline
- Regular security updates

### Network Security

- Internal network isolation
- Only necessary ports exposed
- SSL/TLS encryption in production
- Rate limiting and DDoS protection

### Data Security

- Encrypted secrets management
- Database encryption at rest
- Audit logging for all operations
- Regular security assessments

## Performance Optimization

### Image Optimization

- Multi-stage builds to reduce image size
- .dockerignore to exclude unnecessary files
- Proper layer caching
- Minimal runtime dependencies

### Runtime Performance

- Resource limits and reservations
- Health checks for auto-healing
- Graceful shutdown handling
- Connection pooling for database

### Caching Strategy

- Redis for session storage
- Nginx for static asset caching
- Application-level caching
- CDN integration ready

## Troubleshooting

### Common Issues

1. **Container Won't Start**:
   ```bash
   docker-compose logs [service]
   ./scripts/health-check.sh logs [service]
   ```

2. **Database Connection Issues**:
   ```bash
   ./scripts/health-check.sh deps backend
   docker-compose exec postgres pg_isready
   ```

3. **High Memory Usage**:
   ```bash
   ./scripts/health-check.sh stats
   docker stats
   ```

### Recovery Procedures

1. **Service Restart**:
   ```bash
   docker-compose restart [service]
   ```

2. **Full Reset**:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

3. **Backup Restore**:
   ```bash
   ./scripts/deploy.sh rollback
   ```

## Maintenance

### Regular Tasks

1. **Update Images**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

2. **Clean Up**:
   ```bash
   docker system prune -f
   ./scripts/health-check.sh cleanup
   ```

3. **Monitor Resources**:
   ```bash
   ./scripts/health-check.sh
   docker stats
   ```

### Scaling

1. **Horizontal Scaling**:
   ```bash
   docker-compose up -d --scale backend=3
   ```

2. **Resource Scaling**:
   ```bash
   # Edit docker-compose.yml
   # Add deploy.resources.limits
   ```

## Integration

### CI/CD Pipeline

The containerization is designed for CI/CD integration:

1. **Build Stage**: Build and test images
2. **Security Scan**: Vulnerability scanning
3. **Deploy Stage**: Automated deployment
4. **Health Check**: Post-deployment validation

### External Services

- **Monitoring**: Prometheus/Grafana integration
- **Logging**: ELK stack compatibility
- **Backup**: Cloud storage integration
- **SSL**: Let's Encrypt automation

## Best Practices

### Development

1. Use development compose file for local development
2. Enable hot reloading and debug logging
3. Use volume mounts for live code changes
4. Run health checks regularly

### Production

1. Always use production compose file
2. Enable monitoring and alerting
3. Implement backup strategy
4. Regular security updates

### Security

1. Never commit secrets to version control
2. Use environment-specific configurations
3. Implement proper access controls
4. Regular security assessments

## Support

For issues related to containerization:

1. Check health check script output
2. Review container logs
3. Validate environment configuration
4. Consult troubleshooting section

For application issues, refer to the main SentryVision documentation.