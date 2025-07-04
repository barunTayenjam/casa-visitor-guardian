#!/bin/bash

echo "Starting development environment..."

# Kill any existing processes on the ports
echo "Cleaning up existing processes..."
lsof -ti:9753 | xargs kill -9 2>/dev/null || true
lsof -ti:8082 | xargs kill -9 2>/dev/null || true

# Start the server in the background
echo "Starting backend server..."
cd server
npm run dev &
SERVER_PID=$!

# Wait a bit for server to start
sleep 3

# Go back to root and start frontend
cd ..
echo "Starting frontend..."
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $SERVER_PID"
echo "Frontend PID: $FRONTEND_PID"

# Function to cleanup on exit
cleanup() {
    echo "Cleaning up processes..."
    kill $SERVER_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

echo "Development environment started!"
echo "Frontend: http://localhost:8082"
echo "Backend: http://localhost:9753"
echo "Press Ctrl+C to stop all services"

# Wait for processes
wait