#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Casa Visitor Guardian...${NC}"

# Define the ports used by the application
DEFAULT_BACKEND_PORT=9753
DEFAULT_FRONTEND_PORT=8080

# Function to find an available port starting from the given port
find_available_port() {
  local start_port=$1
  local port=$start_port
  local max_attempts=10
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    if ! lsof -ti :$port > /dev/null; then
      echo $port
      return 0
    fi
    
    port=$((port + 1))
    attempt=$((attempt + 1))
  done
  
  # If no port is available in the range, return the original port
  # and let the other error handling take care of it
  echo $start_port
}

# Find available ports
BACKEND_PORT=$(find_available_port $DEFAULT_BACKEND_PORT)
FRONTEND_PORT=$(find_available_port $DEFAULT_FRONTEND_PORT)

# Display selected ports
if [ $BACKEND_PORT -ne $DEFAULT_BACKEND_PORT ]; then
  echo -e "${YELLOW}Default backend port $DEFAULT_BACKEND_PORT is in use. Using port $BACKEND_PORT instead.${NC}"
fi

if [ $FRONTEND_PORT -ne $DEFAULT_FRONTEND_PORT ]; then
  echo -e "${YELLOW}Default frontend port $DEFAULT_FRONTEND_PORT is in use. Using port $FRONTEND_PORT instead.${NC}"
fi

# Stop any existing processes using the application ports
echo -e "${YELLOW}Checking for existing processes on ports $BACKEND_PORT and $FRONTEND_PORT...${NC}"

# Function to check and kill process on a specific port with retries
kill_process_on_port() {
  local port=$1
  local max_attempts=3
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    local pid=$(lsof -ti :$port)
    if [ -n "$pid" ]; then
      echo -e "${YELLOW}Attempt $attempt: Stopping process on port $port (PID: $pid)...${NC}"
      kill -9 $pid 2>/dev/null
      # Wait a moment for the process to terminate
      sleep 2
      
      # Check if process is still running
      if ! lsof -ti :$port > /dev/null; then
        echo -e "${GREEN}Process on port $port stopped successfully.${NC}"
        return 0
      else
        echo -e "${RED}Process on port $port is still running after kill attempt.${NC}"
      fi
    else
      echo -e "${GREEN}No process found on port $port.${NC}"
      return 0
    fi
    
    attempt=$((attempt + 1))
    sleep 1
  done
  
  # If we get here, we couldn't kill the process after max attempts
  if lsof -ti :$port > /dev/null; then
    echo -e "${RED}Warning: Failed to stop process on port $port after $max_attempts attempts.${NC}"
    echo -e "${YELLOW}You may need to manually stop the process or use a different port.${NC}"
    echo -e "${YELLOW}Trying to proceed anyway...${NC}"
  fi
}

# Kill processes on application ports
kill_process_on_port $BACKEND_PORT
kill_process_on_port $FRONTEND_PORT

# Also kill any npm dev:full processes to be extra safe
if pgrep -f "npm run dev:full" > /dev/null; then
  echo -e "${YELLOW}Stopping existing npm run dev:full processes...${NC}"
  pkill -f "npm run dev:full"
  echo -e "${GREEN}Existing processes stopped.${NC}"
  # Give processes time to fully terminate
  sleep 2
fi

# Install frontend dependencies
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
npm install

# Install backend dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
cd server
npm install
cd ..

# Create .env files if they don't exist
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}Creating frontend .env file...${NC}"
  echo "VITE_BACKEND_URL=http://localhost:$BACKEND_PORT
VITE_API_URL=http://localhost:$BACKEND_PORT/api" > .env
fi

if [ ! -f "server/.env" ]; then
  echo -e "${YELLOW}Creating backend .env file...${NC}"
  echo "PORT=$BACKEND_PORT
FRONTEND_URL=http://localhost:$FRONTEND_PORT" > server/.env
fi

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p server/public/snapshots
mkdir -p server/public/events

# Check if FFmpeg is installed
echo -e "${YELLOW}Checking if FFmpeg is installed...${NC}"
if command -v ffmpeg >/dev/null 2>&1; then
  echo -e "${GREEN}FFmpeg is installed.${NC}"
else
  echo -e "${RED}FFmpeg is not installed. Please install FFmpeg to enable video streaming.${NC}"
  
  # Suggest installation based on OS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}To install FFmpeg on macOS using Homebrew, run:${NC}"
    echo "brew install ffmpeg"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${YELLOW}To install FFmpeg on Ubuntu/Debian, run:${NC}"
    echo "sudo apt-get update && sudo apt-get install -y ffmpeg"
  fi
  
  echo -e "${YELLOW}After installing FFmpeg, run this script again.${NC}"
  exit 1
fi

# Run the application
echo -e "${GREEN}Starting Casa Visitor Guardian...${NC}"
echo -e "${YELLOW}The application will be available at: http://localhost:$FRONTEND_PORT${NC}"
echo -e "${YELLOW}The backend will be running on: http://localhost:$BACKEND_PORT${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the application${NC}"
npm run dev:full
