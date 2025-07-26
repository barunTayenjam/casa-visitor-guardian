#!/bin/bash

echo "=== Quick TensorFlow Fix ==="

cd server

echo "1. Stopping any running server..."
pkill -f "tsx src/index.ts" || true
pkill -f "npm run dev" || true

echo "2. Removing problematic TensorFlow installation..."
rm -rf node_modules/@tensorflow

echo "3. Installing CPU-only TensorFlow (more reliable)..."
npm install @tensorflow/tfjs-node-cpu

echo "4. Testing TensorFlow installation..."
node -e "
import('@tensorflow/tfjs-node-cpu').then(tf => {
  console.log('✅ TensorFlow CPU loaded successfully:', tf.version);
  console.log('✅ Backend:', tf.getBackend());
}).catch(err => {
  console.error('❌ TensorFlow still failing:', err.message);
});
"

echo "5. Updating package.json to use CPU version..."
sed -i.bak 's/"@tensorflow\/tfjs-node":/"@tensorflow\/tfjs-node-cpu":/g' package.json

echo "=== Fix completed ==="
echo "Now restart the server with: npm run dev"