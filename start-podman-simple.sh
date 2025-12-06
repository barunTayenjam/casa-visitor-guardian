#!/bin/bash

# Simple SentryVision Podman Test Deployment
# Uses working minimal containers for immediate testing

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check Podman
if ! command -v podman > /dev/null; then
    echo "Podman not found. Please install Podman."
    exit 1
fi

# Create network
print_status "Creating network..."
podman network create sentryvision-test 2>/dev/null || true

# Stop existing containers
print_status "Cleaning up existing containers..."
podman stop backend frontend 2>/dev/null || true
podman rm backend frontend 2>/dev/null || true

# Start backend (minimal working version)
print_status "Starting backend..."
podman run -d --name backend \
  --network sentryvision-test \
  --network-alias backend \
  -p 9753:9753 \
  sentryvision-backend-test

# Wait for backend
sleep 5

# Test backend
if podman exec backend curl -f http://localhost:9753/api/health > /dev/null; then
    print_success "Backend is running"
else
    echo "Backend failed to start"
    exit 1
fi

# Start frontend
print_status "Starting frontend..."
podman run -d --name frontend \
  --network sentryvision-test \
  -p 3000:3000 \
  sentryvision-frontend-test

# Wait for frontend
sleep 5

# Check containers
print_status "Checking containers..."
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Show access info
echo ""
print_success "SentryVision is now running!"
echo ""
echo "🌐 Access URLs:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:9753"
echo ""
echo "💡 Demo Info:"
echo "  This is a test version with minimal functionality"
echo "  For full features, deploy Docker version on Manjaro server"
echo ""
print_success "Ready to test!"