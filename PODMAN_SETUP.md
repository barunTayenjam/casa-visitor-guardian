# SentryVision Podman Deployment Guide

This guide will help you set up and run SentryVision using Podman containers on a Manjaro system.

## Prerequisites

### On Manjaro Linux

1. **Install Podman**:
```bash
sudo pacman -S podman podman-compose
```

2. **Enable linger for your user** (allows services to run after logout):
```bash
loginctl enable-linger $(whoami)
```

3. **Install additional tools**:
```bash
sudo pacman -S curl wget openssl npm
```

### System Requirements

- At least 4GB of available RAM
- 10GB of free disk space
- User account with sudo access (for initial setup)

## Quick Start

### 1. Clone and Navigate to Project

```bash
cd /path/to/sentryvision
```

### 2. Initial Setup

Run the initial setup script to configure Podman environment:

```bash
chmod +x start-podman.sh
./start-podman.sh setup
```

This will:
- Check Podman and Podman Compose availability
- Configure rootless Podman
- Generate secure passwords and secrets if needed
- Create necessary directories with proper permissions
- Create systemd user services for auto-start

### 3. Configure Environment

Edit the environment file with your configuration:

```bash
nano .env.docker
```

**Important**: Change all default passwords and secrets for production use!

### 4. Start All Services

Run the startup script:

```bash
./start-podman.sh start
```

This will:
- Start all services (PostgreSQL, Redis, Backend, Frontend)
- Wait for services to be healthy
- Display access URLs

### 5. Access SentryVision

Once running, you can access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9753
- **OpenCV Service**: http://localhost:9754
- **Database**: localhost:5432
- **Redis**: localhost:6379

## Rootless Podman Configuration

The setup is optimized for rootless Podman, which provides better security:

1. **User Configuration**: The script will check if your user is configured for rootless Podman
2. **Permissions**: All containers run as non-root users (UID/GID 1001)
3. **File Permissions**: Proper permissions are set for mounted volumes

## Services Overview

### Core Services

1. **PostgreSQL Database** (`postgres`)
   - Port: 5432
   - Database: `sentryvision`
   - User: `sentryvision`
   - Persistent data in Podman volume

2. **Redis Cache** (`redis`)
   - Port: 6379
   - Used for session management and caching
   - Persistent data in Podman volume

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

## Management Commands

The `start-podman.sh` script provides several commands:

### Start Services
```bash
./start-podman.sh start
# or simply
./start-podman.sh
```

### Stop Services
```bash
./start-podman.sh stop
```

### Restart Services
```bash
./start-podman.sh restart
```

### Check Status
```bash
./start-podman.sh status
```

### View Logs
```bash
./start-podman.sh logs
```

### Clean Up
```bash
./start-podman.sh cleanup
```

### Create Systemd Services
```bash
./start-podman.sh service
```

### Help
```bash
./start-podman.sh help
```

## Auto-Start with Systemd

To have SentryVision automatically start when your system boots:

1. **Create systemd services**:
```bash
./start-podman.sh service
```

2. **Enable linger** (if not done during setup):
```bash
loginctl enable-linger $(whoami)
```

3. **Check service status**:
```bash
systemctl --user status sentryvision-podman.service
```

4. **Enable auto-start**:
```bash
systemctl --user enable sentryvision-podman.service
```

## Manual Podman Commands

If you prefer to use Podman Compose directly:

### Start All Services
```bash
podman-compose --env-file .env.docker -f podman-compose.yml up -d
```

### Stop All Services
```bash
podman-compose --env-file .env.docker -f podman-compose.yml down
```

### View Logs
```bash
podman-compose --env-file .env.docker -f podman-compose.yml logs -f
```

### View Specific Service Logs
```bash
podman-compose --env-file .env.docker -f podman-compose.yml logs -f backend
```

## Port Forwarding for Remote Access

To access SentryVision from other devices on your network:

1. **Allow port forwarding** (if using firewall):
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 9753/tcp
sudo ufw allow 9754/tcp
```

2. **Update environment variables** in `.env.docker`:
```bash
# Update CORS_ORIGIN to your server's IP
CORS_ORIGIN=http://192.168.1.100:3000
FRONTEND_URL=http://192.168.1.100:3000
VITE_BACKEND_URL=http://192.168.1.100:9753
```

3. **Restart services**:
```bash
./start-podman.sh restart
```

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   ```bash
   # Fix permissions for volumes
   chown -R $(id -u):$(id -g) logs/ data/
   chmod -R 755 logs/ data/
   ```

2. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3000
   lsof -i :9753
   lsof -i :9754
   
   # Kill processes if needed
   ./start-podman.sh stop
   ```

3. **Podman Not Running**
   ```bash
   # Check Podman status
   podman info
   
   # Start Podman socket
   systemctl --user start podman.socket
   ```

4. **Out of Memory**
   - Monitor system resources with `htop`
   - Stop unused containers
   - Consider reducing container memory limits

5. **Database Connection Issues**
   ```bash
   # Check database logs
   podman-compose logs postgres
   
   # Restart database
   podman-compose restart postgres
   ```

### Health Checks

All services include health checks:

```bash
# Check service health
podman-compose ps

# Check specific service
podman-compose exec backend curl http://localhost:9753/api/health
podman-compose exec opencv-service curl http://localhost:9754/health
podman-compose exec postgres pg_isready -U sentryvision -d sentryvision
podman-compose exec redis redis-cli ping
```

### Logs

View logs for troubleshooting:

```bash
# All services
./start-podman.sh logs

# Specific service
podman-compose logs backend
podman-compose logs frontend
podman-compose logs opencv-service
podman-compose logs postgres
podman-compose logs redis
```

## Security Considerations

1. **Change Default Passwords**: Always change default passwords in `.env.docker`
2. **Network Security**: Services communicate within Podman network
3. **Rootless Mode**: All containers run as non-root users
4. **Secrets Management**: Use proper secret management in production
5. **Firewall**: Configure firewall to only expose necessary ports

## Performance Optimization

1. **Resource Limits**: Monitor system resources with `podman stats`
2. **Database Tuning**: PostgreSQL is pre-configured for performance
3. **Redis Configuration**: Redis is configured with memory limits
4. **Nginx Caching**: Static assets are cached aggressively

## Backup and Recovery

### Database Backup
```bash
# Create backup
podman-compose exec postgres pg_dump -U sentryvision sentryvision > backup.sql

# Restore backup
podman-compose exec -T postgres psql -U sentryvision sentryvision < backup.sql
```

### Volume Backup
```bash
# Backup volumes
podman run --rm -v sentryvision_postgres_data:/data -v $(pwd):/backup docker.io/library/alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

## Migration from Docker

If you're migrating from Docker to Podman:

1. **Export Docker Volumes**:
```bash
docker run --rm -v sentryvision_postgres_data:/data -v $(pwd):/backup docker.io/library/alpine tar czf /backup/docker-postgres-backup.tar.gz -C /data .
```

2. **Import to Podman**:
```bash
podman volume create sentryvision_postgres_data
podman run --rm -v sentryvision_postgres_data:/data -v $(pwd):/backup docker.io/library/alpine tar xzf /backup/docker-postgres-backup.tar.gz -C /data
```

## Differences from Docker

1. **Rootless by Default**: Podman runs containers as non-root users by default
2. **No Daemon**: Podman is daemonless, which improves security
3. **Systemd Integration**: Better integration with systemd for service management
4. **Cgroups V2**: Uses cgroups v2 for better resource management
5. **Compatibility**: Compatible with most Docker commands and Dockerfiles

## Next Steps

1. **Configure Cameras**: Set up your camera configurations
2. **Create Admin User**: Create initial admin account
3. **Test Features**: Verify motion detection and streaming
4. **Set Up Monitoring**: Configure monitoring and alerts
5. **Configure Firewall**: Set up firewall rules for remote access

## Support

For issues and questions:
1. Check the logs using `./start-podman.sh logs`
2. Verify service status with `./start-podman.sh status`
3. Review environment configuration in `.env.docker`
4. Check Podman status with `podman info`

## References

- [Podman Documentation](https://docs.podman.io/)
- [Podman Compose Documentation](https://github.com/containers/podman-compose)
- [SentryVision Documentation](./docs/)