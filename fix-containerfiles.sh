#!/bin/bash

# Fix Missing Containerfiles on Manjaro

set -e

echo "🔧 Fixing Containerfiles for SentryVision..."

cd /home/barun/Documents/home-security

# Create missing Containerfile.opencv
cat > server/Containerfile.opencv << 'EOF'
# OpenCV Service Containerfile
FROM docker.io/library/node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies (skip canvas if issues)
RUN npm ci --omit=dev || \
    (echo "Skipping canvas dependency" && \
     sed -i '/canvas/d' server/package.json && \
     npm ci --omit=dev)

# Copy source
COPY server/ .

# Set environment
ENV NODE_ENV=production
ENV PORT=9754

# Expose port
EXPOSE 9754

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:9754/health || exit 1

# Start application
CMD ["node", "dist/opencv-service.js"]
EOF

echo "✅ Created server/Containerfile.opencv"

# Create missing opencv-service.js
cat > server/src/opencv-service.js << 'EOF'
// Mock OpenCV Service for Testing
const express = require('express');
const app = express();
const port = 9754;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'opencv', port: 9754 });
});

app.get('/', (req, res) => {
  res.json({ message: 'SentryVision OpenCV Service', version: '1.0.0' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`OpenCV service running on port ${port}`);
});
EOF

echo "✅ Created server/src/opencv-service.js"

# Sync missing files
echo "📦 Syncing missing Containerfiles..."
rsync -av --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'data' \
  --exclude 'logs' \
  /Users/baruntayenjam/Code/home-security/server/Containerfile* \
  /Users/baruntayenjam/Code/home-security/server/src/opencv-service.js \
  barun@192.168.31.99:/home/barun/Documents/home-security/server/

echo ""
echo "🎉 Containerfile fixes completed!"
echo "Now run deployment:"
echo "  ./deploy-quick.sh"
EOF