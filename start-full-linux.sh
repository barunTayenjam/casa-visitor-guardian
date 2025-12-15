#!/bin/bash

echo "🐧 Building and Starting SentryVision Full Linux Container..."
echo "This will install ALL dependencies and run the complete application"
echo ""

# Build and run
docker-compose -f docker-compose.full-linux.yml up --build

echo ""
echo "✅ If successful, access your application at:"
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:9753"
echo "👁️  OpenCV Service: http://localhost:8080"
echo "🗄️  PostgreSQL: localhost:5432"