#!/bin/bash

# SentryVision Simple Docker/Podman Launcher
# This script starts SentryVision using the simplified Docker configuration

set -e

echo "🚀 Starting SentryVision with Docker/Podman..."

# Detect if using Podman or Docker
if command -v podman &> /dev/null && ! command -v docker &> /dev/null; then
    CMD="podman-compose"
    echo "📦 Using Podman with podman-compose"
elif command -v docker &> /dev/null; then
    CMD="docker-compose"
    echo "🐳 Using Docker with docker-compose"
else
    echo "❌ Error: Neither Docker nor Podman with docker-compose is installed"
    exit 1
fi

# Create necessary directories if they don't exist
mkdir -p server/public/snapshots
mkdir -p server/public/events
mkdir -p server/logs

# Check if compose file exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found"
    exit 1
fi

# Function to stop services
stop_services() {
    echo "🛑 Stopping services..."
    $CMD -f docker-compose.yml down
    exit 0
}

# Set up trap to catch Ctrl+C
trap stop_services INT

# Start services
echo "🔨 Building and starting services..."
$CMD -f docker-compose.yml --env-file .env.simple up --build

echo "✅ SentryVision is now running!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:9753"
echo "💡 Press Ctrl+C to stop services"