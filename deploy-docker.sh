#!/bin/bash

# SentryVision Docker Deployment Script
# This script sets up and deploys the complete SentryVision system

set -e

echo "🚀 Starting SentryVision Docker Deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p data/snapshots data/events logs

# Set proper permissions
echo "🔒 Setting permissions..."
chmod 755 data data/snapshots data/events logs

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || docker-compose down --remove-orphans 2>/dev/null || true

# Build and start services
echo "🔨 Building and starting services..."
docker compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
docker compose ps

# Run database migrations
echo "🗄️ Running database migrations..."
docker compose exec backend npm run migrate 2>/dev/null || echo "⚠️ Migration command not found, skipping..."

# Show logs
echo "📋 Showing recent logs..."
docker compose logs --tail=50

echo "✅ Deployment complete!"
echo "🌐 Frontend: http://localhost:4000"
echo "🔧 Backend API: http://localhost:8082"
echo "📊 Check status with: docker compose ps"
echo "📋 View logs with: docker compose logs -f"
echo "🛑 Stop with: docker compose down"