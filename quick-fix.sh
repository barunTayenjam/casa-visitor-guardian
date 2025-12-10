#!/bin/bash

echo "🔧 REMOVING ALL DETECTION SERVICE REFERENCES"

# Remove all references to disabled detection services
sed -i '' '/getGlobalMotionDetector/d' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts
sed -i '' '/getGlobalObjectDetectionService/d' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts  
sed -i '' '/getGlobalFacialRecognitionService/d' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts
sed -i '' '/motionDetector = getGlobalMotionDetector/d' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts
sed -i '' '/objectDetectionService = getGlobalObjectDetectionService/d' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts
sed -i '' '/facialRecognitionService = getGlobalFacialRecognitionService/d' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts

echo "✅ Removed detection service references"

# Quick rebuild and test
echo "🔨 Quick rebuild..."
docker-compose build --no-cache backend 2>/dev/null

echo "🔄 Restarting..."
docker-compose restart backend

echo "⏳ Waiting 5 seconds..."
sleep 5

echo "🧪 Testing..."
if curl -s --max-time 3 http://localhost:9753/health > /dev/null; then
    echo "✅ SUCCESS! HTTP requests working!"
    echo "📊 Response:"
    curl -s http://localhost:9753/health
else
    echo "❌ Still hanging"
fi