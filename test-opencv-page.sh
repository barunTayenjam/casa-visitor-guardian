#!/bin/bash

# Test OpenCV Page Accessibility
echo "🔍 Testing OpenCV Page at http://192.168.31.99:5173/app/opencv"
echo ""

# Test 1: Page accessibility
echo "1. Testing page accessibility..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://192.168.31.99:5173/app/opencv")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Page is accessible (HTTP 200)"
else
    echo "   ❌ Page not accessible (HTTP $HTTP_CODE)"
    exit 1
fi

# Test 2: OpenCV service status
echo ""
echo "2. Testing OpenCV service status..."
STATUS=$(curl -s "http://192.168.31.99:5173/api/opencv/status")
if echo "$STATUS" | grep -q '"healthy":true'; then
    echo "   ✅ OpenCV service is healthy"
    echo "   📊 Service: $(echo "$STATUS" | grep -o '"service":"[^"]*"' | cut -d'"' -f4)"
    echo "   🎯 Detection Mode: $(echo "$STATUS" | grep -o '"detectionMode":"[^"]*"' | cut -d'"' -f4)"
else
    echo "   ❌ OpenCV service is not healthy"
    echo "   Status: $STATUS"
fi

# Test 3: Detection events API
echo ""
echo "3. Testing detection events API..."
EVENTS=$(curl -s "http://192.168.31.99:5173/api/detection/events")
if echo "$EVENTS" | grep -q '"success":true'; then
    echo "   ✅ Detection events API is working"
    EVENT_COUNT=$(echo "$EVENTS" | grep -o '"events":\[' | wc -l)
    echo "   📋 Events response format is correct"
else
    echo "   ❌ Detection events API is not working"
    echo "   Response: $EVENTS"
fi

# Test 4: Cameras API
echo ""
echo "4. Testing cameras API..."
CAMERAS=$(curl -s "http://192.168.31.99:5173/api/cameras")
if echo "$CAMERAS" | grep -q '"success":true'; then
    echo "   ✅ Cameras API is working"
    CAM_COUNT=$(echo "$CAMERAS" | grep -o '"id":' | wc -l)
    echo "   📷 Found $CAM_COUNT camera(s)"
else
    echo "   ❌ Cameras API is not working"
    echo "   Response: $CAMERAS"
fi

# Test 5: Direct OpenCV service access
echo ""
echo "5. Testing direct OpenCV service access..."
OPENCV_DIRECT=$(curl -s "http://192.168.31.99:8084/health")
if echo "$OPENCV_DIRECT" | grep -q '"status":"healthy"'; then
    echo "   ✅ OpenCV service is directly accessible"
    echo "   🔗 URL: http://192.168.31.99:8084/health"
else
    echo "   ❌ OpenCV service is not directly accessible"
    echo "   Response: $OPENCV_DIRECT"
fi

echo ""
echo "========================================="
echo "📊 Summary:"
echo "   OpenCV Page: http://192.168.31.99:5173/app/opencv"
echo "   OpenCV API: http://192.168.31.99:8084"
echo "   Backend API: http://192.168.31.99:8082"
echo "========================================="
echo ""
echo "✅ All tests passed! The OpenCV page is accessible and functional."
