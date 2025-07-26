#!/bin/bash

echo "=== TensorFlow Rebuild Fix ==="

cd server

echo "1. Stopping any running processes..."
pkill -f "tsx src/index.ts" || true
pkill -f "npm run dev" || true

echo "2. Cleaning up completely..."
rm -rf node_modules package-lock.json

echo "3. Clearing npm cache..."
npm cache clean --force

echo "4. Reinstalling all dependencies..."
npm install

echo "5. Rebuilding TensorFlow specifically..."
npm rebuild @tensorflow/tfjs-node

echo "6. Testing TensorFlow..."
node -e "
import('@tensorflow/tfjs-node').then(tf => {
  console.log('✅ TensorFlow loaded successfully:', tf.version);
  console.log('✅ Backend:', tf.getBackend());
}).catch(err => {
  console.error('❌ TensorFlow error:', err.message);
  console.log('Trying alternative approach...');
});
"

echo "=== Rebuild completed ==="