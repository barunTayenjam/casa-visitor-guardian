#!/bin/bash

HOST="${1:-localhost}"
OPENCV_PORT=8084
BACKEND_PORT=9753
FRONTEND_PORT=5173

echo "=== SentryVision OpenCV Test Suite ==="
echo "Target: $HOST"
echo ""

PASS=0
FAIL=0

check() {
    local name="$1" url="$2"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   PASS  $name (HTTP $HTTP_CODE)"
        PASS=$((PASS + 1))
    else
        echo "   FAIL  $name (HTTP $HTTP_CODE)"
        FAIL=$((FAIL + 1))
    fi
}

echo "1. OpenCV Service (port $OPENCV_PORT)"
check "Health" "http://$HOST:$OPENCV_PORT/health"

STATUS=$(curl -s "http://$HOST:$OPENCV_PORT/status" 2>/dev/null)
if echo "$STATUS" | grep -q '"status"'; then
    echo "   PASS  Status endpoint responded"
    PASS=$((PASS + 1))
else
    echo "   FAIL  Status endpoint"
    FAIL=$((FAIL + 1))
fi

echo ""
echo "2. Backend API (port $BACKEND_PORT)"
check "Health" "http://$HOST:$BACKEND_PORT/api/health"
check "OpenCV status" "http://$HOST:$BACKEND_PORT/api/opencv/status"
check "Cameras" "http://$HOST:$BACKEND_PORT/api/cameras"

echo ""
echo "3. Frontend (port $FRONTEND_PORT)"
check "Page" "http://$HOST:$FRONTEND_PORT"

echo ""
echo "========================================="
echo "Results: $PASS passed, $FAIL failed"
echo "========================================="

[ "$FAIL" -gt 0 ] && exit 1
exit 0
