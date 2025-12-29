#!/bin/bash

# OpenCV Enhanced SentryVision Deployment Script
echo "🚀 Deploying SentryVision with Enhanced OpenCV Services..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.opencv.yml down -v 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# Build and start services
echo "🔨 Building OpenCV-enhanced services..."
docker-compose -f docker-compose.opencv.yml build --parallel

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi

echo "🚀 Starting services..."
docker-compose -f docker-compose.opencv.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 15

# Check service health
echo "🔍 Checking service health..."

# Check OpenCV service
OPENCV_HEALTH=$(curl -s http://localhost:8084/health 2>/dev/null || echo "failed")
if [[ "$OPENCV_HEALTH" == *"healthy"* ]]; then
    echo "✅ OpenCV Service: Healthy"
else
    echo "❌ OpenCV Service: Not responding"
    docker-compose -f docker-compose.opencv.yml logs opencv-service
fi

# Check main service
MAIN_HEALTH=$(curl -s http://localhost:8082/health 2>/dev/null || echo "failed")
if [[ "$MAIN_HEALTH" == *"healthy"* ]] || [[ "$MAIN_HEALTH" == *"ok"* ]]; then
    echo "✅ Main Service: Healthy"
else
    echo "❌ Main Service: Not responding"
    docker-compose -f docker-compose.opencv.yml logs sentryvision
fi

# Check frontend
FRONTEND_CHECK=$(curl -s http://localhost:5173 2>/dev/null | head -1 || echo "failed")
if [[ "$FRONTEND_CHECK" == *"html"* ]] || [[ "$FRONTEND_CHECK" == *"DOCTYPE"* ]]; then
    echo "✅ Frontend: Running"
else
    echo "⏳ Frontend: Still starting..."
fi

echo ""
echo "🌐 Access Points:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8082"
echo "   OpenCV Service: http://localhost:8084"
echo ""
echo "🔧 Management Commands:"
echo "   View logs: docker-compose -f docker-compose.opencv.yml logs -f"
echo "   Stop services: docker-compose -f docker-compose.opencv.yml down"
echo "   Restart: docker-compose -f docker-compose.opencv.yml restart"
echo ""
echo "🧪 Run tests: ./test-opencv-docker.sh"

# Show service status
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.opencv.yml ps

echo ""
echo "🎉 OpenCV-Enhanced SentryVision deployment completed!"
echo ""
echo "📝 Next Steps:"
echo "   1. Test the OpenCV functionality with ./test-opencv-docker.sh"
echo "   2. Configure your cameras in the web interface"
echo "   3. Enable motion detection and object detection"
echo "   4. Monitor performance and adjust settings as needed"