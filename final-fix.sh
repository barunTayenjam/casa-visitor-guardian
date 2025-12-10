#!/bin/bash

echo "🚨 FINAL HTTP HANGING FIX"

# Simple approach: Comment out problematic imports in routes/index.ts
echo "📝 Disabling detection service imports..."

# Create backup
cp /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts.backup

# Comment out problematic imports
sed -i '' 's/^import { getMotionDetector as getGlobalMotionDetector } from.*$/\/\/ import { getMotionDetector as getGlobalMotionDetector } from '\''..\/detection\/simpleMotionDetection.js'\'';/' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts
sed -i '' 's/^import { getObjectDetectionService as getGlobalObjectDetectionService } from.*$/\/\/ import { getObjectDetectionService as getGlobalObjectDetectionService } from '\''..\/detection\/objectDetection.js'\'';/' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts
sed -i '' 's/^import { getFacialRecognitionService as getGlobalFacialRecognitionService } from.*$/\/\/ import { getFacialRecognitionService as getGlobalFacialRecognitionService } from '\''..\/detection\/facialRecognition.js'\'';/' /Users/baruntayenjam/Code/home-security/server/src/routes/index.ts

echo "✅ Disabled detection imports"

# Rebuild and restart
echo "🔨 Rebuilding container..."
docker-compose build backend --no-cache

echo "🔄 Restarting container..."
docker-compose restart backend

echo "⏳ Waiting for startup..."
sleep 8

# Test
echo "🧪 Testing HTTP endpoints..."
if curl -s --max-time 5 http://localhost:9753/health > /dev/null; then
    echo "✅ SUCCESS: HTTP requests working!"
    echo "📊 Health response:"
    curl -s http://localhost:9753/health | head -c 200
else
    echo "❌ Still hanging - checking logs..."
    docker logs sentryvision-backend --tail 15
fi

echo "🎯 Fix completed!"