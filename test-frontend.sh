#!/bin/bash

echo "🚀 Testing Home Security Frontend..."
echo "=================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run type checking
echo "🔍 Running TypeScript type check..."
npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ TypeScript check failed!"
    exit 1
fi

# Run build
echo "🏗️ Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Run lint check
echo "🔧 Running lint check..."
npm run lint
if [ $? -ne 0 ]; then
    echo "⚠️ Lint found issues (but build succeeded)"
fi

echo ""
echo "✅ Frontend health check passed!"
echo "🎯 Ready to run: npm run dev"
echo "🌐 Available at: http://localhost:5173"
echo ""
echo "📋 Development commands:"
echo "  npm run dev          - Start development server"
echo "  npm run dev:full      - Start both frontend and backend"
echo "  npm run debug         - Open debug page (dev only)"
echo ""