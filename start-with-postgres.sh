#!/bin/bash

echo "Starting SentryVision with PostgreSQL Database..."
echo ""

# Check if docker-compose file exists
if [ ! -f "docker-compose.opencv.yml" ]; then
  echo "Error: docker-compose.opencv.yml not found!"
  exit 1
fi

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.opencv.yml down

# Clean up old volumes (optional - comment out to keep data)
# docker volume rm sentryvision_postgres_data 2>/dev/null || true

# Start containers
echo "Starting containers with PostgreSQL..."
docker-compose -f docker-compose.opencv.yml up -d

# Wait for PostgreSQL to be ready
echo ""
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if docker-compose -f docker-compose.opencv.yml exec -T postgres pg_isready -U sentryvision -d sentryvision &>/dev/null; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

# Check if PostgreSQL is running
if docker-compose -f docker-compose.opencv.yml ps postgres | grep -q "Up"; then
  echo ""
  echo "PostgreSQL container is running"
  echo ""
  echo "Database connection info:"
  echo "  Host: localhost"
  echo "  Port: 5432"
  echo "  Database: sentryvision"
  echo "  User: sentryvision"
  echo "  Password: sentryvision123"
  echo ""
  echo "To run migrations:"
  echo "  cd database && npm run migrate"
  echo ""
else
  echo "Error: PostgreSQL container failed to start"
  docker-compose -f docker-compose.opencv.yml logs postgres
  exit 1
fi

# Show container status
echo "Container status:"
docker-compose -f docker-compose.opencv.yml ps

echo ""
echo "Done! SentryVision with PostgreSQL is now running."
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.opencv.yml logs -f"
echo ""
echo "To stop:"
echo "  docker-compose -f docker-compose.opencv.yml down"
