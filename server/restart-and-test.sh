#!/bin/bash

echo "🔄 Stopping existing server..."
pkill -f "tsx src/index.ts" || echo "No server process found"

echo "⏳ Waiting for process to stop..."
sleep 2

echo "🚀 Starting server in background..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!

echo "📝 Server PID: $SERVER_PID"
echo "⏳ Waiting for server to start..."
sleep 10

echo "🧪 Testing person detector status..."
curl -s http://localhost:9753/api/scan-snapshots-for-persons || echo "Endpoint test failed"

echo ""
echo "📋 Recent server logs:"
tail -n 20 server.log

echo ""
echo "🔍 Looking for person detection setup logs:"
grep -i "person.*detection\|global.*assignment" server.log || echo "No setup logs found"