#!/bin/bash

echo "🚀 Starting SentryVision Simple Monolithic Build..."

# Build and run the simple monolithic container
docker-compose -f docker-compose.simple-monolithic.yml up --build

echo "✅ SentryVision is running!"
echo "🌐 Frontend: http://localhost:9753"
echo "🔧 API: http://localhost:9753/api/health"
echo "📹 Cameras: http://localhost:9753/api/cameras"
echo "📊 Events: http://localhost:9753/api/events"