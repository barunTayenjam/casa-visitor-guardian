#!/bin/bash

echo "🎥 Testing Real Camera Streams"
echo "============================="

# Test if backend is accessible
echo "📍 Testing backend API..."
if curl -s http://localhost:9753/api/cameras > /dev/null 2>&1; then
    echo "✅ Backend API is accessible"
else
    echo "❌ Backend API is not accessible on port 9753"
    exit 1
fi

# Test camera stream endpoints
echo ""
echo "📹 Testing camera stream endpoints..."

# Test cam1 stream
echo "Testing cam1 stream..."
if curl -s -I http://localhost:9753/stream/cam1 | grep -q "200 OK"; then
    echo "✅ Camera 1 stream endpoint responds (200 OK)"
else
    echo "❌ Camera 1 stream endpoint not responding"
fi

# Test cam2 stream  
echo "Testing cam2 stream..."
if curl -s -I http://localhost:9753/stream/cam2 | grep -q "200 OK"; then
    echo "✅ Camera 2 stream endpoint responds (200 OK)"
else
    echo "❌ Camera 2 stream endpoint not responding"
fi

# Test if MJPEG content type is returned
echo ""
echo "🎬 Checking MJPEG content type..."
if curl -s -I http://localhost:9753/stream/cam1 | grep -q "multipart/x-mixed-replace"; then
    echo "✅ MJPEG streaming content type detected"
else
    echo "❌ No MJPEG content type found"
fi

echo ""
echo "🚀 Frontend Ready!"
echo "================="
echo "Run: npm run dev"
echo "Visit: http://localhost:5173"
echo ""
echo "💡 The frontend will now:"
echo "  1. First try real camera streams from your backend"
echo "  2. If streams fail, automatically fall back to simulation"
echo "  3. Show console logs for stream status"
echo ""
echo "📋 Expected behavior:"
echo "  - ✅ Green checkmarks if real streams work"
echo "  - 🔄 Automatic fallback if streams are unavailable"
echo "  - 📊 Console logs showing stream connection attempts"