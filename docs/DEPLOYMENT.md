# SentryVision Docker Deployment Guide

This guide provides comprehensive instructions for deploying SentryVision on a server using Docker and Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Architecture](#docker-architecture)
3. [Configuration](#configuration)
4. [Deployment Steps](#deployment-steps)
5. [Environment Variables](#environment-variables)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Server Requirements

- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **CPU**: Minimum 4 cores, Recommended 8+ cores
- **RAM**: Minimum 8GB, Recommended 16GB+ 
- **Storage**: Minimum 100GB SSD, Recommended 500GB+ SSD
- **Network**: Static IP address with port forwarding capabilities

### Software Requirements

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### Port Requirements

- **80**: HTTP (will redirect to HTTPS)
- **443**: HTTPS (main application)
- **5432**: PostgreSQL (internal only)
- **6379**: Redis (internal only)
- **3000**: Internal API (internal only)

## Docker Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                      │
│                    (Nginx)                          │
│                 Port 80/443                         │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                             │
┌───▼────┐                  ┌─────▼────┐
│ Frontend│                  │  Backend │
│ (React) │                  │ (Node.js) │
│  Port:  │                  │ Port:3000 │
└────────┘                  └─────┬─────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
             ┌──────▼──────┐              ┌───────▼──────┐
             │ PostgreSQL  │              │    Redis     │
             │   Port:5432 │              │   Port:6379  │
             └─────────────┘              └──────────────┘
```

## Configuration

### 1. Environment Configuration

Create environment files:

```bash
# Production environment
cp .env.example .env.production

# Development environment (optional)
cp .env.example .env.development
```

### 2. Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: sentryvision-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - sentryvision-network

  # Frontend React App
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      target: production
    container_name: sentryvision-frontend
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=https://your-domain.com/api
      - REACT_APP_WS_URL=wss://your-domain.com
    volumes:
      - frontend_build:/app/build
    restart: unless-stopped
    networks:
      - sentryvision-network

  # Backend Node.js API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: sentryvision-backend
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=sentryvision
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    volumes:
      - ./logs/backend:/app/logs
      - ./data/uploads:/app/uploads
      - ./data/snapshots:/app/snapshots
      - ./data/events:/app/events
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - sentryvision-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: sentryvision-postgres
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
      - ./logs/postgres:/var/log/postgresql
    restart: unless-stopped
    networks:
      - sentryvision-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c max_connections=200
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c work_mem=4MB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: sentryvision-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
      - ./docker/redis/redis.conf:/etc/redis/redis.conf:ro
      - ./logs/redis:/var/log/redis
    restart: unless-stopped
    networks:
      - sentryvision-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # PgBouncer Connection Pooler
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    container_name: sentryvision-pgbouncer
    environment:
      - DATABASES_HOST=postgres
      - DATABASES_PORT=5432
      - DATABASES_USER=${DB_USER}
      - DATABASES_PASSWORD=${DB_PASSWORD}
      - DATABASES_DBNAME=${DB_NAME}
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=1000
      - DEFAULT_POOL_SIZE=20
      - MIN_POOL_SIZE=5
      - RESERVE_POOL_SIZE=5
      - RESERVE_POOL_TIMEOUT=5
      - SERVER_RESET_QUERY=DISCARD ALL
      - ADMIN_USERS=postgres
      - STATS_USERS=stats,postgres
    volumes:
      - ./docker/pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
      - ./docker/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - sentryvision-network

  # Monitoring Stack (Optional)
  prometheus:
    image: prom/prometheus:latest
    container_name: sentryvision-prometheus
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    restart: unless-stopped
    networks:
      - sentryvision-network
    profiles:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: sentryvision-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./docker/grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped
    networks:
      - sentryvision-network
    profiles:
      - monitoring

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  frontend_build:
    driver: local

networks:
  sentryvision-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 3. Nginx Configuration

Create `docker/nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Include server configurations
    include /etc/nginx/conf.d/*.conf;
}
```

Create `docker/nginx/default.conf`:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS main server
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Frontend static files
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Authentication endpoints
    location /api/auth/ {
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for Socket.io
    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static media files
    location /events/ {
        alias /app/events/;
        expires 1d;
        add_header Cache-Control "public";
    }

    location /snapshots/ {
        alias /app/snapshots/;
        expires 1d;
        add_header Cache-Control "public";
    }
}
```

## Deployment Steps

### 1. Prepare Server

```bash
# Create project directory
sudo mkdir -p /opt/sentryvision
sudo chown $USER:$USER /opt/sentryvision
cd /opt/sentryvision

# Clone repository
git clone https://github.com/your-org/sentryvision.git .

# Create necessary directories
mkdir -p logs/{nginx,backend,postgres,redis}
mkdir -p data/{uploads,snapshots,events}
mkdir -p docker/{nginx,redis,pgbouncer,prometheus,grafana}
mkdir -p database/init
```

### 2. Configure Environment

Edit `.env.production`:

```bash
# Database Configuration
DB_USER=sentryvision
DB_PASSWORD=your-secure-password-here
DB_NAME=sentryvision

# Redis Configuration
REDIS_PASSWORD=your-redis-password-here

# JWT Configuration
JWT_SECRET=your-jwt-secret-256-bit-here
JWT_REFRESH_SECRET=your-jwt-refresh-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Application Configuration
NODE_ENV=production
PORT=3000
DOMAIN=your-domain.com

# SSL Configuration (for Let's Encrypt)
SSL_EMAIL=admin@your-domain.com

# Monitoring (optional)
GRAFANA_PASSWORD=your-grafana-password-here
```

### 3. Build and Deploy

```bash
# Build all images
docker-compose -f docker-compose.yml build

# Start core services
docker-compose -f docker-compose.yml up -d

# Wait for services to be ready
sleep 30

# Run database migrations
docker-compose exec backend npm run migrate

# Create default admin user
docker-compose exec backend npm run seed:admin

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Option B: Self-Signed Certificate (Development)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout docker/ssl/key.pem \
    -out docker/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

## Environment Variables

### Production Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sentryvision
DB_USER=sentryvision
DB_PASSWORD=secure_password_here

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_here

# JWT
JWT_SECRET=256_bit_secret_here
JWT_REFRESH_SECRET=256_bit_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=SentryVision <noreply@your-domain.com>

# Application
DOMAIN=your-domain.com
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com/api

# File Storage
STORAGE_TYPE=local
STORAGE_PATH=/app/data
MAX_FILE_SIZE=100MB

# Security
BCRYPT_ROUNDS=14
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30
```

### Security Environment Variables

```bash
# Security Headers
HELMET_ENABLED=true
CORS_ORIGIN=https://your-domain.com

# Session Security
SESSION_SECRET=256_bit_session_secret_here
SESSION_MAX_AGE=30d

# TOTP
TOTP_ISSUER=SentryVision
TOTP_WINDOW=1

# Audit Logging
AUDIT_SECRET=256_bit_audit_secret_here
AUDIT_RETENTION_DAYS=2555
```

## SSL/TLS Setup

### 1. Let's Encrypt Setup

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Verify renewal
sudo certbot renew --dry-run
```

### 2. SSL Configuration

Update Nginx configuration for SSL:

```nginx
# SSL Configuration
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

### 3. Auto-Renewal

```bash
# Add to crontab
sudo crontab -e

# Add line for daily renewal at 3:30 AM
30 3 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx
```

## Monitoring & Logging

### 1. Application Monitoring

Enable monitoring stack:

```bash
# Deploy monitoring services
docker-compose --profile monitoring up -d

# Access Grafana
# URL: http://your-domain.com:3001
# Username: admin
# Password: (from GRAFANA_PASSWORD environment variable)
```

### 2. Log Management

Log file locations:
- **Nginx**: `/opt/sentryvision/logs/nginx/`
- **Backend**: `/opt/sentryvision/logs/backend/`
- **PostgreSQL**: `/opt/sentryvision/logs/postgres/`
- **Redis**: `/opt/sentryvision/logs/redis/`

### 3. Health Checks

Configure health monitoring:

```bash
# Create health check script
cat > /opt/sentryvision/health-check.sh << 'EOF'
#!/bin/bash

# Check if all containers are running
if ! docker-compose ps | grep -q "Up"; then
    echo "Some services are down"
    docker-compose ps
    exit 1
fi

# Check application health
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Backend health check failed"
    exit 1
fi

echo "All services are healthy"
exit 0
EOF

chmod +x /opt/sentryvision/health-check.sh

# Add to crontab for monitoring every 5 minutes
# */5 * * * * /opt/sentryvision/health-check.sh || /opt/sentryvision/alert.sh
```

## Backup & Recovery

### 1. Database Backup

Create backup script:

```bash
cat > /opt/sentryvision/backup-database.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/sentryvision/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sentryvision_db_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform database backup
docker-compose exec -T postgres pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Database backup completed: $BACKUP_FILE.gz"
EOF

chmod +x /opt/sentryvision/backup-database.sh

# Schedule daily backup at 2 AM
# 0 2 * * * /opt/sentryvision/backup-database.sh
```

### 2. File Backup

```bash
cat > /opt/sentryvision/backup-files.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/sentryvision/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILE_BACKUP="$BACKUP_DIR/sentryvision_files_$DATE.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup important files
tar -czf $FILE_BACKUP \
    /opt/sentryvision/data/ \
    /opt/sentryvision/logs/ \
    /opt/sentryvision/docker/ \
    /opt/sentryvision/.env.production

# Remove file backups older than 7 days
find $BACKUP_DIR -name "*files_*.tar.gz" -mtime +7 -delete

echo "File backup completed: $FILE_BACKUP"
EOF

chmod +x /opt/sentryvision/backup-files.sh

# Schedule weekly backup on Sunday at 3 AM
# 0 3 * * 0 /opt/sentryvision/backup-files.sh
```

### 3. Recovery Procedures

Database Recovery:
```bash
# Stop the application
docker-compose stop backend

# Restore database
gunzip -c /path/to/backup.sql.gz | docker-compose exec -T postgres psql -U $DB_USER $DB_NAME

# Start the application
docker-compose start backend
```

## Troubleshooting

### Common Issues

1. **Container Won't Start**
   ```bash
   # Check logs
   docker-compose logs service-name
   
   # Check resource usage
   docker stats
   ```

2. **Database Connection Issues**
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U $DB_USER
   
   # Check network connectivity
   docker-compose exec backend ping postgres
   ```

3. **SSL Certificate Issues**
   ```bash
   # Check certificate validity
   openssl x509 -in /path/to/cert.pem -text -noout
   
   # Test SSL configuration
   docker-compose exec nginx nginx -t
   ```

4. **Performance Issues**
   ```bash
   # Check resource usage
   docker stats
   
   # Analyze logs for errors
   docker-compose logs --tail=100 backend
   
   # Monitor database performance
   docker-compose exec postgres psql -U $DB_USER -c "SELECT * FROM pg_stat_activity;"
   ```

### Emergency Commands

```bash
# Stop all services immediately
docker-compose down

# Force restart all services
docker-compose restart

# View real-time logs
docker-compose logs -f

# Clean up unused resources
docker system prune -f

# Update all images
docker-compose pull
docker-compose up -d --force-recreate
```

### Support Information

For deployment issues:
1. Check the troubleshooting guide above
2. Review logs in `/opt/sentryvision/logs/`
3. Check Docker container status with `docker-compose ps`
4. Verify environment variables in `.env.production`
5. Test individual service connectivity

For additional support:
- Create an issue in the repository
- Contact the development team
- Review the documentation wiki

---

**Next Steps**: After completing deployment, proceed to [Post-Deployment Configuration](#post-deployment-configuration) and [Monitoring Setup](#monitoring--logging).