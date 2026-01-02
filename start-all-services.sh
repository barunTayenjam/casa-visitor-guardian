#!/bin/bash

# SentryVision Services Startup Script
# Starts services sequentially with proper error handling

set -e

echo "🚀 Starting SentryVision Services..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check if port is in use
check_port() {
    if lsof -i :$1 >/dev/null 2>&1; then
        echo -e "${RED}Port $1 is already in use${NC}"
        return 1  # Return 1 (false) when port is in use
    else
        echo -e "${GREEN}Port $1 is available${NC}"
        return 0  # Return 0 (true) when port is available
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ $service_name is ready!${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}Attempt $attempt/$max_attempts...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ $service_name failed to start${NC}"
    return 1
}

# Function to start service in background
start_service() {
    local command=$1
    local service_name=$2
    local log_file=$3
    
    echo -e "${BLUE}Starting $service_name...${NC}"
    nohup $command > "$log_file" 2>&1 &
    echo $! > "$log_file.pid"
    
    # Wait a moment for the service to start
    sleep 3
    
    # Check if service started successfully
    if ! kill -0 $(cat "$log_file.pid") 2>/dev/null; then
        echo -e "${RED}✗ $service_name failed to start${NC}"
        rm -f "$log_file.pid"
        return 1
    fi
    
    echo -e "${GREEN}✓ $service_name started successfully${NC}"
    return 0
}

# Check if required ports are available
MAIN_PORT=8082
OPENCV_PORT=8084
FRONTEND_PORT=5173

echo -e "${BLUE}Checking port availability...${NC}"

if check_port $MAIN_PORT; then
    echo -e "${GREEN}✓ Main server port $MAIN_PORT is available${NC}"
else
    echo -e "${RED}✗ Main server port $MAIN_PORT is in use${NC}"
    echo -e "${YELLOW}Please stop the service using port $MAIN_PORT${NC}"
    exit 1
fi

if check_port $OPENCV_PORT; then
    echo -e "${GREEN}✓ OpenCV service port $OPENCV_PORT is available${NC}"
else
    echo -e "${RED}✗ OpenCV service port $OPENCV_PORT is in use${NC}"
    echo -e "${YELLOW}Please stop the service using port $OPENCV_PORT${NC}"
    exit 1
fi

if check_port $FRONTEND_PORT; then
    echo -e "${GREEN}✓ Frontend port $FRONTEND_PORT is available${NC}"
else
    echo -e "${RED}✗ Frontend port $FRONTEND_PORT is in use${NC}"
    echo -e "${YELLOW}Please stop the service using port $FRONTEND_PORT${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All ports are available${NC}"

# Start OpenCV Microservice
echo -e "${BLUE}Starting OpenCV Microservice...${NC}"
cd opencv-service
if start_service "npm run dev" "OpenCV Service" "../opencv-service.log" "../opencv-service.pid"; then
    echo -e "${GREEN}✓ OpenCV Microservice started${NC}"
else
    echo -e "${RED}✗ OpenCV Microservice failed to start${NC}"
    exit 1
fi
cd ..

# Wait for OpenCV service to be ready
if ! wait_for_service "http://localhost:$OPENCV_PORT/health" "OpenCV Service"; then
    echo -e "${RED}✗ OpenCV service failed to start${NC}"
    exit 1
fi

# Start Main Server
echo -e "${BLUE}Starting Main Server...${NC}"
cd server
if start_service "npm run dev" "Main Server" "../server.log" "../server.pid"; then
    echo -e "${GREEN}✓ Main Server started${NC}"
else
    echo -e "${RED}✗ Main Server failed to start${NC}"
    exit 1
fi
cd ..

# Wait for Main Server to be ready
if ! wait_for_service "http://localhost:$MAIN_PORT/api/system/detection-ready" "Main Server"; then
    echo -e "${RED}✗ Main Server failed to start${NC}"
    exit 1
fi

# Start Frontend
echo -e "${BLUE}Starting Frontend...${NC}"
if start_service "npm run dev" "Frontend" "frontend.log" "frontend.pid"; then
    echo -e "${GREEN}✓ Frontend started${NC}"
else
    echo -e "${RED}✗ Frontend failed to start${NC}"
    exit 1
fi

# Wait for Frontend to be ready
if ! wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend"; then
    echo -e "${RED}✗ Frontend failed to start${NC}"
    exit 1
fi

# Show status
echo ""
echo -e "${GREEN}🎉 SentryVision Services Status:${NC}"
echo -e "${GREEN}┌─────────────────────────────────┐${NC}"
echo -e "${GREEN}│  OpenCV Service: $(curl -s http://localhost:$OPENCV_PORT/health | jq -r '.status' 2>/dev/null || echo 'unknown')${NC})"
echo -e "${GREEN}│  Main Server:   $(curl -s http://localhost:$MAIN_PORT/api/system/detection-ready | jq -r '.allReady' 2>/dev/null || echo 'unknown')${NC})"
echo -e "${GREEN}│  Frontend:     $(curl -s http://localhost:$FRONTEND_PORT 2>/dev/null || echo 'running')${NC})"
echo -e "${GREEN}└─────────────────────────────────┘${NC}"
echo ""

echo -e "${BLUE}💡 To stop all services:${NC}"
echo -e "${YELLOW}   ./start-all-services.sh stop${NC}"
echo -e "${YELLOW}   Or kill PID files in logs directory${NC}"
echo ""