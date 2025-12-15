#!/bin/sh
set -e

# Function to cleanup on exit
cleanup() {
    echo "Shutting down services..."
    if [ ! -z "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$NGINX_PID" ] && kill -0 "$NGINX_PID" 2>/dev/null; then
        kill $NGINX_PID 2>/dev/null || true
    fi
    # Stop PostgreSQL properly
    su - postgres -c "pg_ctl -D /var/lib/postgresql/data -m fast stop" 2>/dev/null || true
    exit 0
}

# Trap signals
trap cleanup SIGTERM SIGINT

# Ensure directories exist and have correct permissions
mkdir -p /var/lib/postgresql/data /var/run/postgresql /tmp
chown -R postgres:postgres /var/lib/postgresql/data /var/run/postgresql /tmp

# Start PostgreSQL
echo "Starting PostgreSQL..."
if [ ! -d "/var/lib/postgresql/data/base" ]; then
    echo "Initializing PostgreSQL database..."
    su - postgres -c "initdb -D /var/lib/postgresql/data"
else
    echo "PostgreSQL data directory exists, skipping init"
fi

# Start PostgreSQL server
su - postgres -c "pg_ctl -D /var/lib/postgresql/data -l /tmp/postgresql.log start"
sleep 5

# Create database and user
echo "Creating database..."
# Connect to PostgreSQL as postgres user to create database and user
su - postgres -c "psql -c \"CREATE USER sentryvision WITH PASSWORD 'sentryvision123';\"" 2>/dev/null || echo "User may already exist"
su - postgres -c "psql -c \"CREATE DATABASE sentryvision;\"" 2>/dev/null || echo "Database may already exist"
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE sentryvision TO sentryvision;\"" 2>/dev/null || echo "Grant command may have already run"
su - postgres -c "psql -c \"GRANT ALL ON SCHEMA public TO sentryvision;\"" 2>/dev/null || echo "Schema grant may have already run"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    if su - postgres -c "pg_isready -h localhost -p 5432" >/dev/null 2>&1; then
        echo "PostgreSQL is ready"
        break
    fi
    echo "Waiting for PostgreSQL... $i/30"
    sleep 2
done

# Run migrations
echo "Running migrations..."
cd /app/database && npm ci --only=production 2>/dev/null || echo "npm ci may have already run"
npx tsx run-migrations.ts 2>/dev/null || echo "Migrations may have already run or had issues"

# Start backend
echo "Starting backend..."
cd /app/server && node api-server.js &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"
sleep 10

# Configure and start nginx
echo "Starting nginx..."
mkdir -p /etc/nginx/conf.d

# Create nginx config for monolithic setup
cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /app/dist;
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API routes
    location /api {
        proxy_pass http://localhost:9753;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:9753;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Test nginx config before starting
echo "Testing nginx configuration..."
nginx -t || echo "Nginx config test failed, using default config"

nginx -g "daemon off;" &
NGINX_PID=$!
echo "Nginx started with PID: $NGINX_PID"

# Wait for services
echo "All services started!"
echo "Frontend: http://localhost:80"
echo "Backend: http://localhost:9753"
echo "Database: localhost:5432"

# Wait for either process to exit
wait -n
exit_code=$?

echo "One service has stopped (exit code: $exit_code). Shutting down other services..."
cleanup