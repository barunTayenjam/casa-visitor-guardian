#!/bin/bash

echo "=== TensorFlow.js Node Fix Script ==="

cd server

echo "1. Killing any hanging npm processes..."
pkill -f "npm install"

echo "2. Clearing npm cache..."
npm cache clean --force

echo "3. Removing node_modules and package-lock.json..."
rm -rf node_modules package-lock.json

echo "4. Installing dependencies without TensorFlow first..."
npm install --ignore-scripts

echo "5. Installing TensorFlow with specific flags..."
npm install @tensorflow/tfjs-node --build-from-source=false --unsafe-perm=true

echo "6. Testing TensorFlow installation..."
node -e "import('@tensorflow/tfjs-node').then(tf => console.log('✅ TensorFlow loaded successfully:', tf.version)).catch(err => console.error('❌ TensorFlow error:', err.message))"

echo "=== Fix script completed ==="