#!/bin/bash
echo "=== SentryVision Diagnostic ==="
echo "Date: $(date)"

echo -e "\n1. Checking Network Reachability for Cameras..."
CAMERAS_FILE="./server/cameras.json"
if [ -f "$CAMERAS_FILE" ]; then
    IPS=$(grep -oP '"path"\s*:\s*"rtsp://[^@]*@\K[^:]+' "$CAMERAS_FILE" 2>/dev/null || grep -oE '192\.168\.[0-9]+\.[0-9]+' "$CAMERAS_FILE" 2>/dev/null)
    if [ -n "$IPS" ]; then
        echo "$IPS" | sort -u | while read -r ip; do
            ping -c 2 "$ip" > /dev/null 2>&1
            if [ $? -eq 0 ]; then echo "   Camera ($ip): Reachable"; else echo "   Camera ($ip): Unreachable"; fi
        done
    else
        echo "   No camera IPs found in cameras.json"
    fi
else
    echo "   cameras.json not found at $CAMERAS_FILE"
fi

echo -e "\n2. Checking Running Services..."
if pgrep -f "api-server.js" > /dev/null;
then
    echo "   WARNING: 'api-server.js' is running (dummy server without streaming)."
    echo "   Please stop it and run './start-all-services.sh' instead."
fi

if pgrep -f "src/index.ts" > /dev/null || pgrep -f "server/src/index.ts" > /dev/null;
then
    echo "   Backend Server: Running"
else
    echo "   Backend Server: NOT running"
fi

echo -e "\n3. Checking Ports..."
ss -tuln | grep -E '8084|9753|5173' || echo "   No services listening on expected ports"

echo -e "\n4. Checking FFMPEG..."
if command -v ffmpeg > /dev/null;
then
    echo "   System ffmpeg: $(ffmpeg -version | head -n 1)"
else
    echo "   System ffmpeg not found (using ffmpeg-static likely)."
fi

echo -e "\n=== End Diagnostic ==="
