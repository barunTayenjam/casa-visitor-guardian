#!/bin/bash

echo "🚀 Starting SentryVision (Single Container)"

# Stop existing container
echo "🛑 Stopping existing container..."
docker stop sentryvision 2>/dev/null || true
docker rm sentryvision 2>/dev/null || true

# Build and run the monolithic container
echo "🔨 Building and starting container..."
docker run -d \
  --name sentryvision \
  -p 80:80 \
  -p 9753:9753 \
  -p 5432:5432 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/server/cameras.json:/app/server/cameras.json \
  --restart unless-stopped \
  sentryvision:monolithic

echo "✅ SentryVision is running!"
echo "📱 Frontend: http://localhost"
echo "🔧 Backend API: http://localhost:9753"
echo "🗄️  Database: localhost:5432"
echo "📊 View logs: docker logs -f sentryvision"