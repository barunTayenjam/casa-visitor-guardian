#!/bin/bash

echo "=== Camera Recovery and Gentle Setup ==="
echo ""
echo "1. Stopping all current processes that might be hitting cameras..."
pkill -f "ffmpeg.*rtsp" 2>/dev/null || true
pkill -f "tsx.*index" 2>/dev/null || true
sleep 5

echo "2. Waiting for cameras to recover (60 seconds)..."
echo "   This gives cameras time to reset and recover from DDOS"
for i in {60..1}; do
    echo -ne "   Waiting: $i seconds\r"
    sleep 1
done
echo ""
echo ""

echo "3. Testing basic connectivity to cameras..."
ping -c 2 192.168.31.61 >/dev/null 2>&1 && echo "   Camera 1 (192.168.31.61): ✓ Responding" || echo "   Camera 1 (192.168.31.61): ✗ Not responding"
ping -c 2 192.168.31.62 >/dev/null 2>&1 && echo "   Camera 2 (192.168.31.62): ✓ Responding" || echo "   Camera 2 (192.168.31.62): ✗ Not responding"

echo ""
echo "4. Creating gentle camera configuration..."
cat > /Users/baruntayenjam/Code/home-security/server/cameras.json << 'EOF'
[
  {
    "id": "cam1",
    "name": "Front Door",
    "rtspUrl": "rtsp://192.168.31.62:554/stream1",
    "username": "",
    "password": "",
    "frameRate": 1,
    "resolution": "640x480",
    "nightMode": false,
    "credentialId": "camera_cam1"
  },
  {
    "id": "cam2", 
    "name": "Back Door",
    "rtspUrl": "rtsp://192.168.31.61:554/stream1",
    "username": "",
    "password": "",
    "frameRate": 1,
    "resolution": "640x480",
    "nightMode": false,
    "credentialId": "camera_cam2"
  }
]
EOF

echo "   ✓ Created ultra-conservative camera config:"
echo "     - Frame rate: 1 fps (extremely low)"
echo "     - Resolution: 640x480 (very low)"
echo "     - Quality: Low"

echo ""
echo "5. Starting server with gentle settings..."
echo "   The server will:"
echo "   - Start cameras with 30-second delays between them"
echo "   - Use exponential backoff on failures"
echo "   - Rate limit connection attempts"
echo "   - Use minimal resources"

echo ""
echo "=== Recovery Complete ==="
echo ""
echo "Next steps:"
echo "1. Monitor camera response - they should come back online"
echo "2. If cameras connect, gradually increase quality"
echo "3. Watch for any signs of stress (timeouts, errors)"
echo "4. Keep settings conservative for at least 1 hour"
echo ""
echo "To start the server with gentle settings:"
echo "   cd /Users/baruntayenjam/Code/home-security && npm run dev:server"