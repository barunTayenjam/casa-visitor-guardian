#!/bin/bash

echo "=== Starting Backend Server ==="
cd /Users/baruntayenjam/Code/home-security/server
npm run dev &
SERVER_PID=$!
echo "Backend PID: $SERVER_PID"

echo "=== Starting Frontend Server ==="
cd /Users/baruntayenjam/Code/home-security
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "=== Servers Started ==="
echo "Backend: http://localhost:9754"
echo "Frontend: http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop servers"

# Wait for both servers
wait $SERVER_PID $FRONTEND_PID