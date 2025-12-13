#!/bin/sh
set -e

echo "Starting PostgreSQL..."

# Initialize PostgreSQL if needed
if [ ! -f "/var/lib/postgresql/data/PG_VERSION" ]; then
    su - postgres -c "initdb -D /var/lib/postgresql/data"
fi

# Start PostgreSQL
su - postgres -c "pg_ctl -D /var/lib/postgresql/data -l /tmp/postgresql.log start"
sleep 5

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

# Create database and user
echo "Creating database..."
su - postgres -c "createdb sentryvision" || true
su - postgres -c "psql -c \"CREATE USER sentryvision WITH PASSWORD 'sentryvision123';\"" || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE sentryvision TO sentryvision;\"" || true

# Run migrations
echo "Running migrations..."
cd /app/database && npm ci && npx tsx run-migrations.ts || echo "Migrations may have already run"

# Start backend
echo "Starting backend..."
cd /app/server && node api-server.js &
BACKEND_PID=$!
sleep 10

# Configure and start nginx
echo "Starting nginx..."
mkdir -p /etc/nginx/conf.d
cp /app/nginx.conf /etc/nginx/conf.d/default.conf
nginx -g "daemon off;" &
NGINX_PID=$!

# Wait for services
echo "All services started!"
echo "Frontend: http://localhost:80"
echo "Backend: http://localhost:9753"
echo "Database: localhost:5432"

# Function to cleanup on exit
cleanup() {
    echo "Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $NGINX_PID 2>/dev/null || true
    su - postgres -c "pg_ctl -D /var/lib/postgresql/data stop"
    exit 0
}

# Trap signals
trap cleanup SIGTERM SIGINT

# Wait for services to stay running
wait $BACKEND_PID $NGINX_PID