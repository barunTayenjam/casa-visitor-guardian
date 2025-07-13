#!/bin/bash

# Casa Visitor Guardian - Docker Startup Script
# Simple startup with fixed configuration

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Casa Visitor Guardian - Docker Startup${NC}"
echo "========================================"

# Function to check if port is available
is_port_available() {
    ! ss -tuln | grep -q ":$1 "
}

# Function to check if user can run docker without sudo
can_run_docker() {
    docker ps >/dev/null 2>&1
}

# Check Docker permissions
echo -e "\n${YELLOW}Checking Docker permissions...${NC}"
if can_run_docker; then
    echo -e "${GREEN}✓ Docker permissions OK${NC}"
    DOCKER_CMD="docker-compose"
else
    echo -e "${YELLOW}⚠ Docker requires sudo${NC}"
    DOCKER_CMD="sudo docker-compose"
fi

# Check port availability
echo -e "\n${YELLOW}Checking port availability...${NC}"

if is_port_available 3020 && is_port_available 9753; then
    echo -e "${GREEN}✓ Ports 3020 and 9753 available${NC}"
    ACCESS_URL="http://localhost:3020"
elif is_port_available 5173; then
    echo -e "${YELLOW}⚠ Port 3020 busy - using development setup (port 5173)${NC}"
    COMPOSE_FILE="docker-compose.dev.yml"
    ACCESS_URL="http://localhost:5173"
else
    echo -e "${RED}✗ Required ports are busy${NC}"
    echo "Port 3020 (frontend) or 9753 (backend) is in use."
    echo "Please stop other services or use development mode:"
    echo "docker-compose -f docker-compose.dev.yml up --build"
    exit 1
fi

# Use main docker-compose.yml unless development mode
COMPOSE_FILE=${COMPOSE_FILE:-"docker-compose.yml"}

echo -e "\n${BLUE}Starting with: $COMPOSE_FILE${NC}"
echo -e "${BLUE}Access URL: $ACCESS_URL${NC}"

# Ask user for confirmation
echo -e "\n${YELLOW}Options:${NC}"
echo "1. Start normally"
echo "2. Start with build (recommended for first run)"
echo "3. Start in background"
echo "4. Run troubleshooting script first"
echo "5. Cancel"

read -p "Choose option (1-5): " -n 1 -r
echo

case $REPLY in
    1)
        echo -e "\n${GREEN}Starting application...${NC}"
        $DOCKER_CMD -f $COMPOSE_FILE up
        ;;
    2)
        echo -e "\n${GREEN}Starting application with build...${NC}"
        $DOCKER_CMD -f $COMPOSE_FILE up --build
        ;;
    3)
        echo -e "\n${GREEN}Starting application in background...${NC}"
        $DOCKER_CMD -f $COMPOSE_FILE up --build -d
        echo -e "${GREEN}✓ Application started in background${NC}"
        echo -e "${YELLOW}Access: $ACCESS_URL${NC}"
        echo -e "${YELLOW}Stop with: $DOCKER_CMD -f $COMPOSE_FILE down${NC}"
        ;;
    4)
        echo -e "\n${GREEN}Running troubleshooting script...${NC}"
        if [ -f "manjaro-docker-fix.sh" ]; then
            ./manjaro-docker-fix.sh
        else
            echo -e "${RED}✗ manjaro-docker-fix.sh not found${NC}"
        fi
        ;;
    5)
        echo -e "\n${YELLOW}Cancelled${NC}"
        exit 0
        ;;
    *)
        echo -e "\n${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Kill any process using port 9753
PORT=9753
echo "[INFO] Killing any process using port $PORT..."
lsof -ti :$PORT | xargs kill -9 2>/dev/null || true

# Start backend server on port 9753
# (You may need to adjust this command to match your backend start command)
echo "[INFO] Starting backend server on port $PORT..."
export PORT=$PORT
# Example: node server/src/index.js &
# If you use npm/yarn scripts, replace with your actual command:
npm --prefix server run start &
BACKEND_PID=$!

# Wait a few seconds to ensure backend starts
sleep 5

# Print backend status
if ps -p $BACKEND_PID > /dev/null; then
  echo "[SUCCESS] Backend started on port $PORT (PID $BACKEND_PID)"
else
  echo "[ERROR] Backend failed to start. Check logs."
  exit 1
fi

# Start frontend (optional, uncomment if you want to start it here)
# echo "[INFO] Starting frontend (Vite)..."
# npm run dev &
# FRONTEND_PID=$!

# echo "[SUCCESS] Frontend started (PID $FRONTEND_PID)"

# Wait for background jobs (optional)
# wait $BACKEND_PID $FRONTEND_PID