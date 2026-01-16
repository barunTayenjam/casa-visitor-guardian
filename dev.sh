#!/bin/bash

# SentryVision Development Environment Management
# Usage: ./dev.sh up|down|restart|logs|status|build

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Docker compose file
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# Service names
SERVICES="postgres redis backend frontend opencv"

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Create required directories
setup_directories() {
    log_info "Setting up required directories..."
    mkdir -p "${PROJECT_ROOT}/data/detections"
    mkdir -p "${PROJECT_ROOT}/data/events"
    mkdir -p "${PROJECT_ROOT}/data/snapshots"
    mkdir -p "${PROJECT_ROOT}/public/events"
    log_info "Directories ready."
}

# Start the development environment
up() {
    check_docker
    setup_directories
    
    log_info "Starting SentryVision development environment..."
    docker compose -f "${COMPOSE_FILE}" up -d
    
    log_info "Waiting for services to be healthy..."
    sleep 5
    
    # Check service status
    status
    
    log_info "Development environment is ready!"
    log_info ""
    log_info "Access points:"
    log_info "  Frontend: http://localhost:5173"
    log_info "  Backend API: http://localhost:9753"
    log_info "  OpenCV Service: http://localhost:8084"
    log_info "  Database: localhost:5432"
    log_info "  Redis: localhost:6379"
}

# Stop the development environment
down() {
    check_docker
    log_info "Stopping SentryVision development environment..."
    docker compose -f "${COMPOSE_FILE}" down
    log_info "Environment stopped."
}

# Restart a specific service or all services
restart() {
    check_docker
    local service="${1:-all}"
    
    if [ "$service" = "all" ]; then
        log_info "Restarting all services..."
        down
        sleep 2
        up
    else
        log_info "Restarting $service..."
        docker compose -f "${COMPOSE_FILE}" restart "$service"
        log_info "$service restarted."
    fi
}

# View logs
logs() {
    check_docker
    local service="${1:-backend}"
    local follow="${2:-false}"
    
    if [ "$follow" = "-f" ]; then
        docker compose -f "${COMPOSE_FILE}" logs -f "$service"
    else
        docker compose -f "${COMPOSE_FILE}" logs --tail=100 "$service"
    fi
}

# Show service status
status() {
    check_docker
    echo ""
    echo "SentryVision Services Status:"
    echo "=============================="
    docker compose -f "${COMPOSE_FILE}" ps
    echo ""
    
    # Check health of each service
    for svc in $SERVICES; do
        local container_name="sentryvision-${svc}"
        if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
            local state=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")
            if [ "$state" = "running" ]; then
                log_info "$svc: running"
            else
                log_warn "$svc: $state"
            fi
        else
            log_error "$svc: not found"
        fi
    done
}

# Build images
build() {
    check_docker
    log_info "Building Docker images..."
    docker compose -f "${COMPOSE_FILE}" build --no-cache
    log_info "Images built successfully."
}

# Rebuild a specific service
rebuild() {
    local service="${1:-backend}"
    check_docker
    log_info "Rebuilding $service..."
    docker compose -f "${COMPOSE_FILE}" build --no-cache "$service"
    log_info "$service rebuilt. Run 'dev.sh restart $service' to apply changes."
}

# Clean up everything (data volumes too)
clean() {
    check_docker
    log_warn "This will remove all data volumes. Continue? (y/N)"
    read -r response
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        log_info "Cleaning up..."
        docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans
        docker system prune -f
        log_info "Cleanup complete."
    else
        log_info "Aborted."
    fi
}

# Show help
help() {
    echo "SentryVision Development Environment Management"
    echo ""
    echo "Usage: ./dev.sh <command> [service]"
    echo ""
    echo "Commands:"
    echo "  up [service]     Start the environment (optionally start specific service)"
    echo "  down             Stop the environment"
    echo "  restart [service] Restart services (default: all)"
    echo "  logs [service]   View logs (use -f to follow)"
    echo "  status           Show service status"
    echo "  build            Build all Docker images"
    echo "  rebuild <service> Rebuild specific service"
    echo "  clean            Remove all data and stop services"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh up              # Start all services"
    echo "  ./dev.sh up backend      # Start only backend"
    echo "  ./dev.sh logs -f         # Follow all logs"
    echo "  ./dev.sh logs frontend   # View frontend logs"
    echo "  ./dev.sh restart frontend # Restart frontend"
    echo "  ./dev.sh rebuild opencv  # Rebuild OpenCV image"
}

# Main script logic
case "${1:-help}" in
    up) up ;;
    down) down ;;
    restart) restart "${2:-all}" ;;
    logs) logs "${2:-backend}" "${3:-}" ;;
    status) status ;;
    build) build ;;
    rebuild) rebuild "${2:-backend}" ;;
    clean) clean ;;
    help|--help|-h) help ;;
    *)
        log_error "Unknown command: $1"
        help
        exit 1
        ;;
esac
