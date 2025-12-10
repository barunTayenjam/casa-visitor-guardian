#!/bin/bash
# Comprehensive Docker Fix and Deployment Script for SentryVision

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "======================================"
echo "SentryVision Docker Fix & Deploy"
echo "======================================"
echo ""

# Function to print colored output
print_status() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if Docker is running
print_status "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running!"
    echo ""
    echo "Please start Docker:"
    echo "  - On macOS: Open Docker Desktop"
    echo "  - On Linux: sudo systemctl start docker"
    echo "  - Using Colima: colima start"
    exit 1
fi
print_success "Docker is running"

# Check Docker Compose
print_status "Checking Docker Compose..."
if ! docker-compose --version > /dev/null 2>&1; then
    print_error "Docker Compose is not available!"
    exit 1
fi
print_success "Docker Compose is available"

# Stop any running containers
print_status "Stopping any running containers..."
docker-compose down 2>/dev/null || true
print_success "Containers stopped"

# Clean up old images (optional)
if [ "$1" == "--clean" ]; then
    print_status "Removing old images..."
    docker-compose down --rmi local 2>/dev/null || true
    print_success "Old images removed"
fi

# Build backend
print_status "Building backend service..."
if docker-compose build backend 2>&1 | tee /tmp/backend-build.log | tail -20; then
    print_success "Backend build completed"
else
    print_error "Backend build failed. Check /tmp/backend-build.log for details"
    exit 1
fi

# Build frontend
print_status "Building frontend service..."
if docker-compose build frontend 2>&1 | tee /tmp/frontend-build.log | tail -20; then
    print_success "Frontend build completed"
else
    print_error "Frontend build failed. Check /tmp/frontend-build.log for details"
    exit 1
fi

# Start services
print_status "Starting services..."
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 10

# Check service status
echo ""
echo "======================================"
echo "Service Status"
echo "======================================"
docker-compose ps

# Test endpoints
echo ""
echo "======================================"
echo "Testing Endpoints"
echo "======================================"

# Test backend health
print_status "Testing backend health endpoint..."
if curl -s http://localhost:9753/health | grep -q "ok"; then
    print_success "Backend is healthy"
else
    print_warning "Backend health check failed (may still be starting)"
fi

# Test frontend
print_status "Testing frontend..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    print_success "Frontend is accessible"
else
    print_warning "Frontend not yet accessible (may still be starting)"
fi

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "Access the application:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:9753"
echo ""
echo "Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Stop services:    docker-compose down"
echo "  Restart:          docker-compose restart"
echo "  View status:      docker-compose ps"
echo ""
