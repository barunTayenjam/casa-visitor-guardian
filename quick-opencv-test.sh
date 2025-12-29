#!/bin/bash

echo "🧪 Testing OpenCV Service Implementation..."

echo "1. Checking OpenCV Service Health..."
HEALTH=$(curl -s http://localhost:8084/health)
echo "Health Response: $HEALTH"

echo ""
echo "2. Checking OpenCV Service Status..."
STATUS=$(curl -s http://localhost:8084/status)
echo "Status Response: $STATUS"

echo ""
echo "3. Checking Main Service Health..."
MAIN_HEALTH=$(curl -s http://localhost:8082/health 2>/dev/null)
echo "Main Service Health: $MAIN_HEALTH"

echo ""
echo "4. Testing Container Status..."
docker-compose -f docker-compose.opencv.yml ps

echo ""
echo "5. OpenCV Service Logs (last 10 lines)..."
docker-compose -f docker-compose.opencv.yml logs --tail=10 opencv-service

echo ""
echo "6. Main Service Logs (last 10 lines)..."
docker-compose -f docker-compose.opencv.yml logs --tail=10 sentryvision

echo ""
echo "7. Creating Test Image..."
# Create a simple test image in the container
docker-compose -f docker-compose.opencv.yml exec opencv-service sh -c "
echo 'Creating test image...' && \
mkdir -p /app/data/snapshots && \
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 -d > /app/data/snapshots/test.png && \
ls -la /app/data/snapshots/ || echo 'No snapshots directory'
"

echo ""
echo "8. Testing Object Detection..."
curl -X POST http://localhost:8084/detect-objects \
  -H "Content-Type: application/json" \
  -d '{
    "imagePath": "/app/data/snapshots/test.png",
    "fileHash": "test123",
    "fileSize": 67,
    "fileModified": "2025-12-26T09:00:00Z"
  }' 2>/dev/null | head -c 500

echo ""
echo ""
echo "9. Testing Face Recognition..."
curl -X POST http://localhost:8084/recognize-faces \
  -H "Content-Type: application/json" \
  -d '{
    "imagePath": "/app/data/snapshots/test.png", 
    "fileHash": "test123",
    "fileSize": 67,
    "fileModified": "2025-12-26T09:00:00Z"
  }' 2>/dev/null | head -c 500

echo ""
echo ""
echo "✅ OpenCV Service Testing Complete!"
echo ""
echo "📊 Summary:"
echo "   - OpenCV Service: http://localhost:8084"
echo "   - Main Service: http://localhost:8082" 
echo "   - Frontend: http://localhost:5173"
echo "   - Health checks completed"
echo "   - API endpoints tested"