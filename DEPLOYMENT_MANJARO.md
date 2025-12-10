# 🚀 Deployment to Manjaro Server

Yes! Let's deploy and test the containerization on your Manjaro server. I've created comprehensive deployment scripts for you.

## 📋 Quick Start

### 1. Update Configuration
Edit the deployment script with your server details:

```bash
# Edit the script and update these lines:
SERVER_USER="your_username"    # Your SSH username on Manjaro server
SERVER_HOST="your_server_ip"   # Your server IP address
```

### 2. Choose Deployment Method

#### Option A: Automated Deployment (Recommended)
```bash
./deploy-to-manjaro.sh
```

#### Option B: Manual Step-by-Step
```bash
# Test configuration
./test-deploy.sh

# Sync files (update credentials first)
rsync -avz --progress --exclude-from=/tmp/rsync-exclude.txt ./ your_user@your_server:/opt/sentryvision/

# Build containers
ssh your_user@your_server 'cd /opt/sentryvision && docker-compose -f docker-compose.prod.yml build --no-cache'

# Start services
ssh your_user@your_server 'cd /opt/sentryvision && docker-compose -f docker-compose.prod.yml up -d'
```

## 🔧 What the Scripts Do

### Automated Script Features:
- ✅ **Dependency Check**: Validates rsync and SSH availability
- ✅ **Connection Test**: Tests SSH connectivity before sync
- ✅ **Smart Sync**: Excludes unnecessary files (node_modules, logs, .git)
- ✅ **Docker Setup**: Installs Docker and Docker Compose if needed
- ✅ **Container Build**: Builds all containers with no-cache
- ✅ **Health Checks**: Validates build and configuration
- ✅ **Cleanup**: Removes temporary files

### File Exclusions:
- `node_modules/`, `dist/`, `build/`
- `.git/`, `.DS_Store`, IDE files
- Logs, cache, temporary files
- Environment files (except production)

## 🖥️ Manjaro Server Requirements

### Prerequisites:
- SSH access with key-based authentication
- `sudo` privileges for Docker installation
- At least 4GB RAM and 20GB disk space

### Docker Installation (handled by script):
```bash
# Manual installation if needed:
sudo pacman -Sy docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

## 🧪 Testing the Deployment

### 1. Build Test:
```bash
# Test frontend build specifically
ssh your_user@your_server 'cd /opt/sentryvision && docker-compose -f docker-compose.prod.yml build frontend --no-cache'

# Test backend build specifically  
ssh your_user@your_server 'cd /opt/sentryvision && docker-compose -f docker-compose.prod.yml build backend --no-cache'
```

### 2. Service Status:
```bash
# Check running containers
ssh your_user@your_server 'cd /opt/sentryvision && docker-compose -f docker-compose.prod.yml ps'

# Check logs
ssh your_user@your_server 'cd /opt/sentryvision && docker-compose -f docker-compose.prod.yml logs -f'
```

### 3. Health Checks:
```bash
# Test frontend health
curl http://your_server_ip/health

# Test backend health
curl http://your_server_ip/api/health

# Check nginx status
curl http://your_server_ip/
```

## 🚨 Troubleshooting

### Common Issues:

1. **Permission Denied**:
   ```bash
   # Add user to docker group and re-login
   sudo usermod -aG docker $USER
   ```

2. **Port Conflicts**:
   ```bash
   # Check port usage
   sudo netstat -tlnp | grep :80
   sudo netstat -tlnp | grep :9753
   ```

3. **Build Failures**:
   ```bash
   # Clean build
   docker system prune -f
   docker-compose -f docker-compose.prod.yml build --no-cache
   ```

4. **Memory Issues**:
   ```bash
   # Check system resources
   free -h
   df -h
   ```

## 📊 Expected Results

### Successful Deployment:
- ✅ Frontend container builds and serves on port 80
- ✅ Backend container builds and serves API on port 9753
- ✅ Nginx reverse proxy routes traffic correctly
- ✅ All health checks pass
- ✅ Application accessible at `http://your_server_ip`

### Container Status:
```
NAME                     COMMAND                  SERVICE   STATUS              PORTS
sentryvision-frontend    "nginx -g 'daemon off…"   frontend   running             80/tcp
sentryvision-backend     "docker-entrypoint.sh …"   backend    running             9753/tcp
sentryvision-nginx      "/docker-entrypoint.sh …"   nginx      running             80:80/tcp, 443:443/tcp
sentryvision-postgres    "docker-entrypoint.sh …"   postgres   running             5432/tcp
sentryvision-redis      "redis-server /etc/re…"   redis      running             6379/tcp
```

## 🎯 Ready to Deploy?

1. **Update server credentials** in `deploy-to-manjaro.sh`
2. **Run the deployment script**: `./deploy-to-manjaro.sh`
3. **Monitor the build process** - it may take 10-15 minutes
4. **Access your application** at `http://your_server_ip`

Let me know what your server IP/hostname is, and I can help you customize the script! 🚀