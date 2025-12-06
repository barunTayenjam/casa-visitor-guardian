#!/bin/bash

# SentryVision Podman Health Check Script
# This script checks the health of all SentryVision services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Podman is running
check_podman() {
    if ! podman info > /dev/null 2>&1; then
        print_error "Podman is not running"
        return 1
    fi
    print_success "Podman is running"
    return 0
}

# Function to check if services are running
check_services() {
    print_status "Checking service status..."
    
    # Check if podman-compose is available
    if ! command -v podman-compose > /dev/null 2>&1; then
        print_error "podman-compose not found"
        return 1
    fi
    
    # Get service status
    SERVICES=$(podman-compose --env-file .env.docker -f podman-compose.yml ps -q)
    
    if [ -z "$SERVICES" ]; then
        print_error "No services are running"
        return 1
    fi
    
    # Check each service
    podman-compose --env-file .env.docker -f podman-compose.yml ps
    
    return 0
}

# Function to check service health
check_health() {
    print_status "Checking service health..."
    
    # Check PostgreSQL
    print_status "Checking PostgreSQL..."
    if podman-compose --env-file .env.docker -f podman-compose.yml exec -T postgres pg_isready -U ${DB_USER:-sentryvision} -d ${DB_NAME:-sentryvision} > /dev/null 2>&1; then
        print_success "PostgreSQL is healthy"
    else
        print_error "PostgreSQL is not healthy"
    fi
    
    # Check Redis
    print_status "Checking Redis..."
    if podman-compose --env-file .env.docker -f podman-compose.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is healthy"
    else
        print_error "Redis is not healthy"
    fi
    
    # Check Backend API
    print_status "Checking Backend API..."
    if curl -f http://localhost:${BACKEND_PORT:-9753}/api/health > /dev/null 2>&1; then
        print_success "Backend API is healthy"
    else
        print_error "Backend API is not healthy"
    fi
    
    # Check OpenCV Service
    print_status "Checking OpenCV Service..."
    if curl -f http://localhost:${OPENCV_PORT:-9754}/health > /dev/null 2>&1; then
        print_success "OpenCV Service is healthy"
    else
        print_error "OpenCV Service is not healthy"
    fi
    
    # Check Frontend
    print_status "Checking Frontend..."
    if curl -f http://localhost:${FRONTEND_PORT:-3000} > /dev/null 2>&1; then
        print_success "Frontend is healthy"
    else
        print_error "Frontend is not healthy"
    fi
}

# Function to check resource usage
check_resources() {
    print_status "Checking resource usage..."
    
    # Get resource statistics
    if podman stats --no-stream > /dev/null 2>&1; then
        podman stats --no-stream
    else
        print_warning "Unable to get resource statistics"
    fi
    
    # Check system resources
    print_status "System resources:"
    echo "Memory: $(free -h | grep Mem)"
    echo "Disk: $(df -h / | tail -1)"
    echo "Load: $(uptime)"
}

# Function to check connectivity
check_connectivity() {
    print_status "Checking connectivity..."
    
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    if [ -n "$SERVER_IP" ]; then
        # Check local connectivity
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            print_success "Local frontend accessible"
        else
            print_error "Local frontend not accessible"
        fi
        
        # Check remote connectivity
        if curl -f http://$SERVER_IP:3000 > /dev/null 2>&1; then
            print_success "Remote frontend accessible (IP: $SERVER_IP)"
        else
            print_warning "Remote frontend not accessible (IP: $SERVER_IP)"
        fi
    else
        print_warning "Unable to determine server IP"
    fi
}

# Function to check logs for errors
check_logs() {
    print_status "Checking logs for errors..."
    
    # Get recent logs for each service
    SERVICES=("postgres" "redis" "backend" "opencv-service" "frontend")
    
    for SERVICE in "${SERVICES[@]}"; do
        print_status "Recent logs for $SERVICE:"
        
        # Get last 10 lines of logs and filter for errors
        ERRORS=$(podman-compose --env-file .env.docker -f podman-compose.yml logs --tail=10 $SERVICE 2>&1 | grep -i error || true)
        
        if [ -n "$ERRORS" ]; then
            print_error "Errors found in $SERVICE:"
            echo "$ERRORS"
        else
            print_success "No errors found in $SERVICE"
        fi
        
        echo ""
    done
}

# Function to check volumes
check_volumes() {
    print_status "Checking volumes..."
    
    # List all volumes
    podman volume ls | grep sentryvision || true
    
    # Check volume mounts
    print_status "Volume mounts:"
    SERVICES=("postgres" "redis" "backend" "opencv-service" "frontend")
    
    for SERVICE in "${SERVICES[@]}"; do
        CONTAINER=$(podman ps --filter name=sentryvision-$SERVICE --format {{.Names}} | head -1)
        if [ -n "$CONTAINER" ]; then
            print_status "Volume mounts for $CONTAINER:"
            podman inspect $CONTAINER --format='{{range .Mounts}}{{.Destination}}:{{.Source}}{{"\n"}}{{end}}'
        fi
    done
}

# Function to check ports
check_ports() {
    print_status "Checking port usage..."
    
    PORTS=(${DB_PORT:-5432} ${REDIS_PORT:-6379} ${BACKEND_PORT:-9753} ${OPENCV_PORT:-9754} ${FRONTEND_PORT:-3000})
    
    for PORT in "${PORTS[@]}"; do
        if lsof -i :$PORT > /dev/null 2>&1; then
            print_success "Port $PORT is in use"
            lsof -i :$PORT | head -2
        else
            print_warning "Port $PORT is not in use"
        fi
        echo ""
    done
}

# Function to run comprehensive diagnostics
run_diagnostics() {
    print_status "Running comprehensive diagnostics..."
    
    echo ""
    check_podman
    echo ""
    check_services
    echo ""
    check_health
    echo ""
    check_resources
    echo ""
    check_connectivity
    echo ""
    check_ports
    echo ""
    check_volumes
    echo ""
    check_logs
    
    print_success "Diagnostics completed"
}

# Main script logic
case "${1:-all}" in
    "all")
        run_diagnostics
        ;;
    "services")
        check_services
        ;;
    "health")
        check_health
        ;;
    "resources")
        check_resources
        ;;
    "connectivity")
        check_connectivity
        ;;
    "logs")
        check_logs
        ;;
    "volumes")
        check_volumes
        ;;
    "ports")
        check_ports
        ;;
    "help"|"-h"|"--help")
        echo "SentryVision Podman Health Check Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  all         Run all diagnostic checks (default)"
        echo "  services    Check service status"
        echo "  health      Check service health"
        echo "  resources   Check resource usage"
        echo "  connectivity Check network connectivity"
        echo "  logs        Check logs for errors"
        echo "  volumes     Check volume mounts"
        echo "  ports       Check port usage"
        echo "  help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0              # Run all checks"
        echo "  $0 health       # Check service health only"
        echo "  $0 logs         # Check logs for errors only"
        ;;
    *)
        print_error "Unknown command: $1"
        print_status "Use '$0 help' for available commands"
        exit 1
        ;;
esac