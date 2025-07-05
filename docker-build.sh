#!/bin/bash

# Docker build script for Casa Visitor Guardian
set -e

echo "🐳 Building Casa Visitor Guardian Docker containers..."

# Function to print colored output
print_status() {
    echo -e "\033[1;34m$1\033[0m"
}

print_success() {
    echo -e "\033[1;32m$1\033[0m"
}

print_error() {
    echo -e "\033[1;31m$1\033[0m"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Parse command line arguments
MODE="production"
CLEAN=false
NO_CACHE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dev|--development)
            MODE="development"
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --dev, --development    Build for development with hot reloading"
            echo "  --clean                 Clean up containers and images before building"
            echo "  --no-cache             Build without using Docker cache"
            echo "  --help, -h             Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Clean up if requested
if [ "$CLEAN" = true ]; then
    print_status "🧹 Cleaning up existing containers and images..."
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    docker system prune -f
    print_success "✅ Cleanup completed"
fi

# Set build arguments
BUILD_ARGS=""
if [ "$NO_CACHE" = true ]; then
    BUILD_ARGS="--no-cache"
fi

# Build based on mode
if [ "$MODE" = "development" ]; then
    print_status "🔧 Building for development mode..."
    docker-compose -f docker-compose.dev.yml build $BUILD_ARGS
    print_success "✅ Development build completed!"
    echo ""
    print_status "🚀 To start the development environment, run:"
    echo "   docker-compose -f docker-compose.dev.yml up"
else
    print_status "🏭 Building for production mode..."
    docker-compose build $BUILD_ARGS
    print_success "✅ Production build completed!"
    echo ""
    print_status "🚀 To start the production environment, run:"
    echo "   docker-compose up -d"
fi

echo ""
print_status "📊 Docker images created:"
docker images | grep -E "(casa-visitor-guardian|frontend|backend)" || echo "No images found with expected names"

echo ""
print_success "🎉 Build process completed successfully!"