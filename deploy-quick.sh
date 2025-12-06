#!/bin/bash

# Quick SentryVision Deployment on Manjaro (No Firewall, Port 4000)

set -e

echo "🚀 SentryVision Deployment on Manjaro"
echo "=================================="

# Navigate to project
cd /home/barun/Documents/home-security

# Stop existing services
echo "🔄 Stopping existing services..."
docker-compose --env-file .env.docker down || true

# Create environment file if missing
if [ ! -f ".env.docker" ]; then
    if [ -f ".env.docker.template" ]; then
        cp .env.docker.template .env.docker
        echo "✅ Environment file created"
    elif [ -f ".env" ]; then
        cp .env .env.docker
        echo "✅ Environment file copied from .env"
    else
        echo "❌ No environment file found"
        exit 1
    fi
else
    echo "✅ Environment file exists"
fi

# Deploy with port 4000
echo "📦 Deploying SentryVision (Port 4000)..."
docker-compose --env-file .env.docker -f docker-compose.4000.yml up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 30

# Check status
echo "📊 Checking service status..."
docker-compose --env-file .env.docker -f docker-compose.4000.yml ps

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "🌐 Access URLs:"
echo "  Frontend (Port 4000): http://localhost:4000"
if [ -n "$SERVER_IP" ]; then
    echo "  Frontend (Remote):   http://$SERVER_IP:4000"
fi
echo "  Backend API:        http://localhost:9753"
echo "  Database:          localhost:5432"
echo "  Redis:             localhost:6379"
echo ""
echo "🔧 Management:"
echo "  Check logs: docker-compose --env-file .env.docker -f docker-compose.4000.yml logs -f"
echo "  Stop:       docker-compose --env-file .env.docker -f docker-compose.4000.yml down"
echo "  Restart:    docker-compose --env-file .env.docker -f docker-compose.4000.yml restart"
echo ""
echo "🎯 SentryVision is ready at: http://localhost:4000"