#!/bin/bash

echo "🚀 Starting SentryVision (Simple Docker Setup)"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.simple.yml down

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.simple.yml up --build

echo "✅ SentryVision is running!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:9753"
echo "🗄️  Database: localhost:5432"