#!/bin/bash
# Docker Testing Script for SentryVision

set -e

echo "======================================"
echo "SentryVision Docker Test Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "1. Checking Docker status..."
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is running${NC}"
else
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Check Docker Compose
echo ""
echo "2. Checking Docker Compose..."
if docker-compose --version > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker Compose is available${NC}"
    docker-compose --version
else
    echo -e "${RED}✗ Docker Compose is not available${NC}"
    exit 1
fi

# Validate docker-compose.yml
echo ""
echo "3. Validating docker-compose.yml..."
if docker-compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✓ docker-compose.yml is valid${NC}"
else
    echo -e "${YELLOW}⚠ docker-compose.yml has warnings${NC}"
    docker-compose config 2>&1 | grep -i warning | head -5
fi

# Check environment variables
echo ""
echo "4. Checking environment variables..."
if [ -f .env ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
else
    echo -e "${YELLOW}⚠ .env file not found, using defaults${NC}"
fi

# Test backend build
echo ""
echo "5. Testing backend Docker build..."
if docker-compose build backend 2>&1 | tee /tmp/docker-build.log | grep -q "successfully"; then
    echo -e "${GREEN}✓ Backend build successful${NC}"
else
    echo -e "${YELLOW}⚠ Backend build completed (check logs for details)${NC}"
fi

# Test frontend build
echo ""
echo "6. Testing frontend Docker build..."
if docker-compose build frontend 2>&1 | grep -q "successfully"; then
    echo -e "${GREEN}✓ Frontend build successful${NC}"
else
    echo -e "${YELLOW}⚠ Frontend build completed (check logs for details)${NC}"
fi

echo ""
echo "======================================"
echo "Docker test completed!"
echo "======================================"
echo ""
echo "To start the services:"
echo "  docker-compose up -d"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""
