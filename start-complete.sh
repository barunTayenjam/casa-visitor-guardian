#!/bin/bash

echo "🚀 Starting Complete Batch Processing System"
echo "=================================="

# Kill any existing processes
echo "🛑 Stopping existing processes..."
pkill -f "npm run dev" || true
pkill -f "tsx" || true
sleep 2

# Start backend server
echo "🔧 Starting Backend Server..."
cd /Users/baruntayenjam/Code/home-security/server
npm run dev &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 5

# Test backend
echo "🧪 Testing Backend..."
curl -s http://localhost:9754/api/batch/jobs | head -5

# Start frontend server
echo "🎨 Starting Frontend Server..."
cd /Users/baruntayenjam/Code/home-security
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Both Servers Started!"
echo "=================================="
echo "Backend: http://localhost:9754"
echo "Frontend: http://localhost:5173"
echo ""
echo "📋 Next Steps:"
echo "1. Open http://localhost:5173 in browser"
echo "2. Find 'Batch Processing' in menu"
echo "3. Look for completed jobs (green status)"
echo "4. Click 👁️ eye icon"
echo "5. You should see detection overlays!"
echo ""
echo "Press Ctrl+C to stop servers"

# Wait for user to stop
wait $BACKEND_PID $FRONTEND_PID