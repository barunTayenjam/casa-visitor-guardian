# Manjaro Docker Troubleshooting Guide

This guide addresses common Docker Compose issues on Manjaro Linux.

## Quick Fix

Run the automated fix script:
```bash
chmod +x manjaro-docker-fix.sh
./manjaro-docker-fix.sh
```

## Common Issues and Solutions

### 1. Permission Denied Errors

**Problem**: `permission denied while trying to connect to the Docker daemon socket`

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply group changes (choose one):
newgrp docker              # Apply immediately
# OR log out and log back in
```

### 2. Port 80 Already in Use

**Problem**: `bind: address already in use` for port 80

**Solutions**:

**Option A**: Use alternative compose file with different ports
```bash
docker-compose -f docker-compose.manjaro.yml up --build
```
This uses port 3000 instead of 80.

**Option B**: Stop conflicting services
```bash
# Check what's using port 80
sudo ss -tulnp | grep :80

# Stop common web servers
sudo systemctl stop apache2   # or httpd
sudo systemctl stop nginx
sudo systemctl stop lighttpd
```

**Option C**: Use development mode (port 5173)
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### 3. Docker Service Not Running

**Problem**: `Cannot connect to the Docker daemon`

**Solution**:
```bash
# Start and enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Check status
sudo systemctl status docker
```

### 4. Firewall Blocking Connections

**Problem**: Can't access the application from browser

**Solutions**:

**For UFW**:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 9753/tcp
sudo ufw allow 3000/tcp  # If using manjaro compose file
```

**For Firewalld**:
```bash
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=9753/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 5. Build Failures

**Problem**: Docker build fails with various errors

**Solutions**:

**Clean Docker cache**:
```bash
docker system prune -a
docker builder prune
```

**Check disk space**:
```bash
df -h
# Ensure you have at least 2GB free space
```

**Update Docker**:
```bash
sudo pacman -Syu docker docker-compose
```

### 6. Health Check Failures

**Problem**: Containers fail health checks

**Solution**: The updated Dockerfile now uses `wget` instead of `curl` for better compatibility.

If still failing:
```bash
# Check container logs
docker-compose logs frontend
docker-compose logs backend

# Test health endpoints manually
curl http://localhost/health      # Frontend
curl http://localhost:9753/api/health  # Backend
```

## Alternative Deployment Options

### Option 1: Use Manjaro-specific Compose File
```bash
docker-compose -f docker-compose.manjaro.yml up --build
```
- Uses port 3000 instead of 80
- Uses `serve` instead of nginx
- Avoids common port conflicts

### Option 2: Development Mode
```bash
docker-compose -f docker-compose.dev.yml up --build
```
- Uses port 5173 for frontend
- Includes hot reloading
- Better for development

### Option 3: Manual Port Configuration
Create or edit `.env.manjaro` file:
```bash
# Set custom ports
FRONTEND_PORT=3001
BACKEND_PORT=9754
```

Then run:
```bash
docker-compose -f docker-compose.manjaro.yml --env-file .env.manjaro up --build
```

## Verification Steps

After applying fixes:

1. **Test Docker**:
   ```bash
   docker run --rm hello-world
   ```

2. **Check ports**:
   ```bash
   ss -tuln | grep -E ":(80|9753|3000|5173)"
   ```

3. **Start application**:
   ```bash
   docker-compose up --build
   ```

4. **Access application**:
   - Production: http://localhost (or http://localhost:3000 with manjaro compose)
   - Development: http://localhost:5173

## Getting Help

If issues persist:

1. **Check Docker logs**:
   ```bash
   journalctl -u docker.service
   ```

2. **Check system logs**:
   ```bash
   dmesg | grep -i docker
   ```

3. **Test with sudo** (temporary workaround):
   ```bash
   sudo docker-compose up --build
   ```

4. **Restart Docker service**:
   ```bash
   sudo systemctl restart docker
   ```

5. **Reboot system** (if all else fails):
   ```bash
   sudo reboot
   ```

## Manjaro-Specific Notes

- Manjaro uses rolling releases, so Docker versions may be newer
- Some packages might have different names than Ubuntu/Debian
- AppArmor/SELinux might interfere with Docker
- Firewall is often enabled by default

## Success Indicators

You know it's working when:
- `docker-compose ps` shows all containers as "Up" and "healthy"
- You can access the web interface
- No permission errors in logs
- Health checks pass