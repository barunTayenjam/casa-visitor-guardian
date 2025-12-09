# Quick Start: Docker Deployment on Manjaro

## Prerequisites

```bash
# Install Docker and Docker Compose
sudo pacman -S docker docker-compose

# Start and enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (logout/login required)
sudo usermod -aG docker $USER
```

## Option 1: Simple Development Setup

```bash
# Clone your project
git clone <your-repo-url> home-security
cd home-security

# Create environment file
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## Option 2: Full Production Setup

```bash
# Clone your project
git clone <your-repo-url> home-security
cd home-security

# Create production environment file
cp .env.example .env

# Edit .env with your settings
nano .env
```

Required `.env` variables:
```env
# Database
DB_NAME=sentryvision
DB_USER=sentryvision
DB_PASSWORD=your_secure_password

# Redis
REDIS_PASSWORD=your_redis_password

# JWT Secrets
JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret

# Security
TOTP_SECRET=your_totp_secret
BACKUP_CODE_ENCRYPTION_KEY=your_backup_key
AUDIT_INTEGRITY_SECRET=your_audit_secret

# Optional: Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
```

```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Initialize database
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Create admin user
docker-compose -f docker-compose.prod.yml exec backend npm run create-admin
```

## Access Your System

- **Frontend**: http://localhost (production) or http://localhost:5173 (development)
- **Backend API**: http://localhost/api (production) or http://localhost:9753 (development)

## Management Commands

```bash
# Stop services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access backend shell
docker-compose exec backend sh

# Access database
docker-compose exec postgres psql -U sentryvision -d sentryvision

# Update containers
docker-compose pull
docker-compose up -d --force-recreate
```

## Monitoring (Optional)

```bash
# Start with monitoring stack
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Access Grafana
# URL: http://localhost:3001
# Username: admin
# Password: (from GRAFANA_PASSWORD env var)
```

## Backup Data

```bash
# Backup database
docker-compose exec postgres pg_dump -U sentryvision sentryvision > backup.sql

# Restore database
docker-compose exec -T postgres psql -U sentryvision sentryvision < backup.sql
```

## Troubleshooting

```bash
# Check container status
docker-compose ps

# Rebuild containers
docker-compose build --no-cache

# Clean up
docker-compose down -v
docker system prune -f
```

That's it! Your SentryVision system is now running in containers without any Python/Node.js dependency issues.