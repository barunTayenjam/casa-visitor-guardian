#!/bin/bash

echo "=== Alternative TensorFlow Fix ==="

cd server

echo "Option 1: Use CPU-only version"
npm uninstall @tensorflow/tfjs-node
npm install @tensorflow/tfjs-node-cpu

echo "Option 2: Use different TensorFlow version"
# npm install @tensorflow/tfjs-node@4.20.0

echo "Option 3: Use tfjs without node backend"
# npm uninstall @tensorflow/tfjs-node
# npm install @tensorflow/tfjs

echo "Testing installation..."
node -e "import('@tensorflow/tfjs-node-cpu').then(tf => console.log('✅ TensorFlow CPU loaded:', tf.version)).catch(err => console.error('❌ Error:', err.message))"