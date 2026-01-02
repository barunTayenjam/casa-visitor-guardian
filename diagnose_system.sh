#!/bin/bash
echo "=== SentryVision Diagnostic ==="
echo "Date: $(date)"

echo -e "\n1. Checking Network Reachability for Cameras..."
# Extract camera IPs from cameras.json if possible, otherwise hardcode based on user input
ping -c 2 192.168.31.61 > /dev/null 2>&1
if [ $? -eq 0 ]; then echo "✅ Camera 1 (192.168.31.61) is REACHABLE"; else echo "❌ Camera 1 (192.168.31.61) is UNREACHABLE"; fi

ping -c 2 192.168.31.62 > /dev/null 2>&1
if [ $? -eq 0 ]; then echo "✅ Camera 2 (192.168.31.62) is REACHABLE"; else echo "❌ Camera 2 (192.168.31.62) is UNREACHABLE"; fi

echo -e "\n2. Checking Running Services..."
if pgrep -f "api-server.js" > /dev/null;
then
    echo "⚠️  WARNING: 'api-server.js' is running. This is the DUMMY server without streaming."
    echo "   Please stop it and run './start-all-services.sh' instead."
fi

if pgrep -f "src/index.ts" > /dev/null || pgrep -f "server/src/index.ts" > /dev/null;
then
    echo "✅ Real Backend Server seems to be running."
else
    echo "❌ Real Backend Server is NOT running."
fi

echo -e "\n3. Checking Ports..."
netstat -tuln | grep -E '8082|9753|5173'

echo -e "\n4. Checking FFMPEG..."
# Check if ffmpeg-static is usable or system ffmpeg
if command -v ffmpeg > /dev/null;
then
    echo "✅ System ffmpeg found: $(ffmpeg -version | head -n 1)"
else
    echo "ℹ️  System ffmpeg not found (using ffmpeg-static likely)."
fi

echo -e "\n=== End Diagnostic ==="
