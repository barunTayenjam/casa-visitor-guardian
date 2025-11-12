# Home Security System - Enhanced Production Deployment Guide

## Overview

This guide covers the deployment of the enhanced Home Security System with production-grade security, performance optimization, and monitoring capabilities.

## 🚀 System Enhancements

### Security Features
- **Enhanced Authentication**: Rate-limited login attempts, session management, JWT validation
- **Input Validation**: Comprehensive validation using Joi with XSS protection
- **Rate Limiting**: Redis-based distributed rate limiting with IP blocking
- **Security Headers**: Helmet.js with custom CSP and HSTS
- **Credential Management**: Encrypted storage with automatic rotation
- **Audit Logging**: Comprehensive event tracking with security audit trail

### Performance Features
- **Async File Operations**: Cached file operations with LRU eviction
- **Enhanced Streaming**: Improved RTSP stream management with error recovery
- **Event Bus Architecture**: Asynchronous event processing with queues
- **Metrics Collection**: Prometheus-compatible metrics with performance tracking
- **Health Checks**: Comprehensive system health monitoring
- **Connection Pooling**: Optimized database and cache connections

### Monitoring Features
- **Real-time Metrics**: HTTP requests, response times, error rates
- **Health Endpoints**: System health, component status, performance metrics
- **Event Monitoring**: Security events, system events, performance alerts
- **Alerting**: Memory, CPU, disk usage, and performance threshold alerts

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: Minimum 50GB (100GB+ recommended for video storage)
- **CPU**: Multi-core processor (4+ cores recommended)
- **Network**: Stable network with bandwidth for video streams

### Software Requirements
- **Redis**: For caching and rate limiting
- **SQLite**: For local database storage
- **FFmpeg**: For video stream processing
- **Docker**: (Optional) For containerized deployment
- **Nginx**: (Recommended) For reverse proxy and SSL termination

## 🔧 Installation

### 1. Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd home-security/server

# Install enhanced dependencies
cp package_enhanced.json package.json
npm install

# Create production environment file
cp .env.example .env.production
```

### 2. Environment Configuration

Create `.env.production` with the following variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Security
JWT_SECRET=your-super-secure-jwt-secret-here
API_KEY_SECRET=your-api-key-secret
SESSION_SECRET=your-session-secret-here
BCRYPT_ROUNDS=12

# Database
DATABASE_PATH=./data/database.sqlite
DATABASE_BACKUP_PATH=./data/backups

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Storage
SNAPSHOTS_DIR=./public/snapshots
EVENTS_DIR=./public/events
BATCH_RESULTS_DIR=./public/batch-results

# Security Settings
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000
SESSION_DURATION=86400000
MAX_SESSIONS_PER_USER=5

# Performance
MAX_CONNECTIONS=100
MAX_CONCURRENT_STREAMS=50
CLEANUP_INTERVAL=300000
MEMORY_THRESHOLD_MB=512

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/application.log
AUDIT_LOG_FILE=./logs/audit.log

# Security Headers
CSP_POLICY=default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
HSTS_MAX_AGE=31536000

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
PERFORMANCE_MONITORING=true

# Camera Configuration (encrypted stored)
CAMERA_CONFIG_ENCRYPTION_KEY=your-camera-config-key
```

### 3. Security Configuration

```bash
# Generate secure secrets
node -e "
const crypto = require('crypto');
console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex'));
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('API_KEY_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('CAMERA_CONFIG_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
"
```

### 4. Database Setup

```bash
# Create database directory
mkdir -p ./data ./data/backups ./logs

# Initialize database
npm run init-batch-db

# Run database migrations (if applicable)
npm run migrate
```

## 🚀 Deployment Options

### Option 1: Direct Node.js Deployment

```bash
# Build the application
npm run build

# Start production server
npm start

# Or use PM2 for process management
pm2 start ecosystem.config.js --env production
```

### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install FFmpeg and Redis CLI
RUN apk add --no-cache ffmpeg redis

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY dist/ ./dist/
COPY public/ ./public/

# Create data directories
RUN mkdir -p ./data ./logs ./public/snapshots ./public/events

# Set permissions
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./public:/app/public
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped

volumes:
  redis_data:
```

### Option 3: PM2 Process Management

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'home-security',
    script: 'dist/index_enhanced.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '512M',
    node_args: '--max-old-space-size=1024',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Configure UFW (Ubuntu/Debian)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 3000/tcp
sudo ufw deny 3000/udp
sudo ufw deny 6379/tcp  # Redis should not be exposed
```

### 2. SSL/TLS Configuration

```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security headers
        proxy_set_header X-Frame-Options DENY;
        proxy_set_header X-Content-Type-Options nosniff;
        proxy_set_header X-XSS-Protection "1; mode=block";
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. System Hardening

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install fail2ban
sudo apt install fail2ban -y

# Configure fail2ban for nginx
sudo tee /etc/fail2ban/jail.local << EOF
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 📊 Monitoring and Maintenance

### 1. Health Checks

```bash
# Quick health check
curl -f http://localhost:3000/api/health/quick

# Comprehensive health check
curl -f http://localhost:3000/api/health

# System information
curl -f http://localhost:3000/api/system/info
```

### 2. Metrics Collection

```bash
# Prometheus metrics
curl http://localhost:3000/api/metrics

# Application metrics
curl http://localhost:3000/api/metrics/app
```

### 3. Log Management

```bash
# View application logs
tail -f ./logs/application.log

# View audit logs
tail -f ./logs/audit.log

# Log rotation (configure with logrotate)
sudo tee /etc/logrotate.d/home-security << EOF
/path/to/home-security/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 node node
    postrotate
        pm2 reload home-security
    endscript
}
EOF
```

### 4. Backup Strategy

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup database
cp ./data/database.sqlite $BACKUP_DIR/

# Backup configuration
cp .env.production $BACKUP_DIR/

# Backup snapshots (last 7 days)
find ./public/snapshots -type f -mtime -7 -exec cp {} $BACKUP_DIR/snapshots/ \;

# Compress backup
tar -czf $BACKUP_DIR.tar.gz -C /backups $(basename $BACKUP_DIR)
rm -rf $BACKUP_DIR

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR.tar.gz s3://your-backup-bucket/
```

## 🔧 Performance Tuning

### 1. Node.js Optimization

```bash
# Environment variables for production
export NODE_OPTIONS="--max-old-space-size=1024 --optimize-for-size"
export UV_THREADPOOL_SIZE=16
export NODE_ENV=production
```

### 2. Redis Configuration

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 3. Database Optimization

```sql
-- SQLite optimization
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
```

## 🚨 Alerting Setup

### 1. Email Alerts

```javascript
// Configure in config/index.js
const alerts = {
  email: {
    enabled: true,
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    recipients: ['admin@example.com']
  },
  thresholds: {
    memoryUsage: 90,
    cpuUsage: 80,
    diskUsage: 85,
    errorRate: 5
  }
};
```

### 2. Slack Integration

```javascript
// Webhook integration for alerts
const slackWebhook = process.env.SLACK_WEBHOOK_URL;

async function sendAlert(message, severity) {
  await fetch(slackWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message,
      attachments: [{
        color: severity === 'critical' ? 'danger' : 'warning',
        fields: [{
          title: 'Home Security System Alert',
          value: message,
          short: false
        }]
      }]
    })
  });
}
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Secrets generated and secured
- [ ] Database initialized
- [ ] SSL certificates obtained
- [ ] Firewall rules configured
- [ ] Backup strategy implemented

### Post-Deployment
- [ ] Health checks passing
- [ ] Monitoring enabled
- [ ] Alerting configured
- [ ] Log rotation set up
- [ ] Performance baseline established
- [ ] Security audit completed

### Testing
- [ ] Authentication flow tested
- [ ] Rate limiting verified
- [ ] Camera streaming tested
- [ ] Event monitoring tested
- [ ] Load testing completed
- [ ] Security testing performed

## 🔍 Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory usage
   node --inspect=0.0.0.0:9229 dist/index_enhanced.js
   # Profile memory usage in Chrome DevTools
   ```

2. **Connection Issues**
   ```bash
   # Check active connections
   netstat -an | grep :3000
   
   # Check Redis connection
   redis-cli ping
   ```

3. **Performance Issues**
   ```bash
   # Check Node.js performance
   node --prof dist/index_enhanced.js
   node --prof-process isolate-*.log > processed.txt
   ```

### Emergency Procedures

1. **System Overload**
   ```bash
   # Scale down connections
   pm2 stop home-security
   pm2 start ecosystem.config.js --env production --instances 1
   ```

2. **Security Incident**
   ```bash
   # Block IP addresses
   sudo iptables -A INPUT -s <IP_ADDRESS> -j DROP
   
   # Review logs
   grep "security" ./logs/application.log
   ```

## 📚 Additional Resources

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Security Guidelines](https://owasp.org/www-project-nodejs/)
- [Performance Optimization](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Monitoring Setup](https://prometheus.io/docs/guides/go-application/)

---

**Note**: This deployment guide assumes you're deploying in a production environment. For development, refer to the development setup documentation.