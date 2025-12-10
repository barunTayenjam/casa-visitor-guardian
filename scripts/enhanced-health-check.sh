#!/bin/bash

# Comprehensive Docker Health Check Script for SentryVision
# This script performs thorough health checks on all Docker services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PROJECT_NAME="${PROJECT_NAME:-sentryvision}"
TIMEOUT="${TIMEOUT:-30}"
RETRY_COUNT="${RETRY_COUNT:-3}"

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if Docker is running
check_docker() {
    print_status $BLUE "🐳 Checking Docker status..."
    if ! docker info > /dev/null 2>&1; then
        print_status $RED "❌ Docker is not running or not accessible"
        exit 1
    fi
    print_status $GREEN "✅ Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    print_status $BLUE "📦 Checking Docker Compose availability..."
    if ! command -v docker-compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            print_status $RED "❌ Docker Compose is not available"
            exit 1
        fi
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    print_status $GREEN "✅ Docker Compose is available: $COMPOSE_CMD"
}

# Function to validate Docker Compose configuration
validate_compose_config() {
    print_status $BLUE "🔧 Validating Docker Compose configuration..."
    if ! $COMPOSE_CMD -f $COMPOSE_FILE config > /dev/null 2>&1; then
        print_status $RED "❌ Docker Compose configuration is invalid"
        print_status $YELLOW "Run: $COMPOSE_CMD -f $COMPOSE_FILE config"
        exit 1
    fi
    print_status $GREEN "✅ Docker Compose configuration is valid"
}

# Function to check container status
check_container_status() {
    local service=$1
    print_status $BLUE "🔍 Checking container status for $service..."
    
    local container_id=$($COMPOSE_CMD -f $COMPOSE_FILE ps -q $service 2>/dev/null)
    if [ -z "$container_id" ]; then
        print_status $RED "❌ Container for $service is not running"
        return 1
    fi
    
    local status=$(docker inspect --format='{{.State.Status}}' $container_id 2>/dev/null)
    local health=$(docker inspect --format='{{.State.Health.Status}}' $container_id 2>/dev/null)
    
    if [ "$status" = "running" ]; then
        if [ "$health" = "healthy" ] || [ "$health" = "" ]; then
            print_status $GREEN "✅ Container $service is running ($status)"
            if [ "$health" = "healthy" ]; then
                print_status $GREEN "✅ Health check passed for $service"
            fi
            return 0
        else
            print_status $YELLOW "⚠️  Container $service is running but health check is $health"
            return 1
        fi
    else
        print_status $RED "❌ Container $service is not running (status: $status)"
        return 1
    fi
}

# Function to check service health endpoint
check_service_endpoint() {
    local service=$1
    local endpoint=$2
    local port=$3
    local host=${4:-localhost}
    
    print_status $BLUE "🌐 Checking health endpoint for $service..."
    
    local url="http://$host:$port$endpoint"
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        print_status $GREEN "✅ Health endpoint for $service is responding (200)"
        return 0
    else
        print_status $YELLOW "⚠️  Health endpoint for $service returned $response"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    print_status $BLUE "🗄️  Checking database connectivity..."
    
    if $COMPOSE_CMD -f $COMPOSE_FILE exec -T postgres pg_isready -U ${DB_USER:-sentryvision} -d ${DB_NAME:-sentryvision} > /dev/null 2>&1; then
        print_status $GREEN "✅ PostgreSQL is ready and accepting connections"
        return 0
    else
        print_status $RED "❌ PostgreSQL is not ready"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    print_status $BLUE "📦 Checking Redis connectivity..."
    
    if $COMPOSE_CMD -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_status $GREEN "✅ Redis is responding"
        return 0
    else
        print_status $RED "❌ Redis is not responding"
        return 1
    fi
}

# Function to check resource usage
check_resource_usage() {
    print_status $BLUE "📊 Checking resource usage..."
    
    local containers=$($COMPOSE_CMD -f $COMPOSE_FILE ps -q)
    local total_cpu=0
    local total_memory=0
    
    while IFS= read -r container_id; do
        if [ -n "$container_id" ]; then
            local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" $container_id 2>/dev/null | tail -n +2)
            if [ -n "$stats" ]; then
                local cpu=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
                local memory=$(echo "$stats" | awk '{print $2}' | sed 's/MiB//')
                local service=$(docker inspect --format='{{.Name}}' $container_id | sed 's/\///')
                
                print_status $BLUE "📈 $service: CPU $cpu%, Memory ${memory}MiB"
                
                # Check for high resource usage
                if (( $(echo "$cpu > 80" | bc -l) )); then
                    print_status $YELLOW "⚠️  $service has high CPU usage: $cpu%"
                fi
                
                if (( $(echo "$memory > 512" | bc -l) )); then
                    print_status $YELLOW "⚠️  $service has high memory usage: ${memory}MiB"
                fi
            fi
        fi
    done <<< "$containers"
    
    print_status $GREEN "✅ Resource usage check completed"
}

# Function to check disk space
check_disk_space() {
    print_status $BLUE "💾 Checking disk space..."
    
    local disk_usage=$(df -h . | tail -n 1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        print_status $RED "❌ Disk usage is critically high: ${disk_usage}%"
        return 1
    elif [ "$disk_usage" -gt 80 ]; then
        print_status $YELLOW "⚠️  Disk usage is high: ${disk_usage}%"
        return 1
    else
        print_status $GREEN "✅ Disk usage is acceptable: ${disk_usage}%"
        return 0
    fi
}

# Function to check network connectivity
check_network() {
    print_status $BLUE "🌐 Checking network connectivity..."
    
    local services=$($COMPOSE_CMD -f $COMPOSE_FILE config --services)
    
    while IFS= read -r service; do
        if [ -n "$service" ]; then
            # Check if service can resolve other services
            if $COMPOSE_CMD -f $COMPOSE_FILE exec -T $service nslookup postgres > /dev/null 2>&1; then
                print_status $GREEN "✅ $service can resolve postgres"
            else
                print_status $YELLOW "⚠️  $service cannot resolve postgres"
            fi
            
            if $COMPOSE_CMD -f $COMPOSE_FILE exec -T $service nslookup redis > /dev/null 2>&1; then
                print_status $GREEN "✅ $service can resolve redis"
            else
                print_status $YELLOW "⚠️  $service cannot resolve redis"
            fi
        fi
    done <<< "$services"
}

# Function to check logs for errors
check_logs() {
    local service=$1
    local lines=${2:-50}
    
    print_status $BLUE "📋 Checking logs for $service (last $lines lines)..."
    
    local error_count=$($COMPOSE_CMD -f $COMPOSE_FILE logs --tail=$lines $service 2>/dev/null | grep -i -c "error\|exception\|fatal" || echo 0)
    
    if [ "$error_count" -gt 0 ]; then
        print_status $YELLOW "⚠️  Found $error_count errors in logs for $service"
        return 1
    else
        print_status $GREEN "✅ No errors found in logs for $service"
        return 0
    fi
}

# Function to display container logs
show_logs() {
    local service=$1
    local lines=${2:-50}
    
    print_status $BLUE "📋 Showing logs for $service (last $lines lines)..."
    $COMPOSE_CMD -f $COMPOSE_FILE logs --tail=$lines $service
}

# Function to cleanup old resources
cleanup() {
    print_status $BLUE "🧹 Cleaning up old Docker resources..."
    
    # Remove unused images
    local unused_images=$(docker images -f "dangling=true" -q)
    if [ -n "$unused_images" ]; then
        docker rmi $unused_images > /dev/null 2>&1
        print_status $GREEN "✅ Removed dangling images"
    fi
    
    # Remove unused containers
    local stopped_containers=$(docker ps -a -q --filter "status=exited")
    if [ -n "$stopped_containers" ]; then
        docker rm $stopped_containers > /dev/null 2>&1
        print_status $GREEN "✅ Removed stopped containers"
    fi
    
    # Cleanup volumes
    docker volume prune -f > /dev/null 2>&1
    print_status $GREEN "✅ Cleaned up unused volumes"
}

# Function to display help
show_help() {
    echo "SentryVision Docker Health Check Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  check              Run full health check (default)"
    echo "  status            Check container status only"
    echo "  endpoints         Check service endpoints only"
    echo "  resources         Check resource usage"
    echo "  disk              Check disk space"
    echo "  network           Check network connectivity"
    echo "  logs [SERVICE]    Check logs for errors"
    echo "  show [SERVICE]    Show logs for service"
    echo "  cleanup           Clean up old Docker resources"
    echo "  help              Show this help message"
    echo ""
    echo "Options:"
    echo "  -f, --file FILE   Use specific Docker Compose file"
    echo "  -t, --timeout N   Set timeout in seconds (default: 30)"
    echo "  -r, --retry N     Set retry count (default: 3)"
    echo "  -n, --name NAME   Set project name (default: sentryvision)"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run full health check"
    echo "  $0 status                     # Check container status only"
    echo "  $0 logs backend               # Check backend logs for errors"
    echo "  $0 show frontend              # Show frontend logs"
    echo "  $0 -f docker-compose.dev.yml # Use development compose file"
}

# Main execution
main() {
    local command=${1:-check}
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -r|--retry)
                RETRY_COUNT="$2"
                shift 2
                ;;
            -n|--name)
                PROJECT_NAME="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done
    
    print_status $BLUE "🚀 Starting SentryVision Health Check"
    print_status $BLUE "📁 Using compose file: $COMPOSE_FILE"
    print_status $BLUE "🏷️  Project name: $PROJECT_NAME"
    echo ""
    
    # Basic checks
    check_docker
    check_docker_compose
    validate_compose_config
    echo ""
    
    case $command in
        check)
            print_status $BLUE "🏥 Running comprehensive health check..."
            echo ""
            
            # Check all containers
            local services=$($COMPOSE_CMD -f $COMPOSE_FILE config --services)
            local all_healthy=true
            
            while IFS= read -r service; do
                if [ -n "$service" ]; then
                    if ! check_container_status $service; then
                        all_healthy=false
                    fi
                fi
            done <<< "$services"
            
            echo ""
            
            # Check service endpoints
            check_service_endpoint "frontend" "/health" "${FRONTEND_PORT:-3000}"
            check_service_endpoint "backend" "/api/health" "${BACKEND_PORT:-9753}"
            
            echo ""
            
            # Check database and Redis
            check_database
            check_redis
            
            echo ""
            
            # Check resource usage
            check_resource_usage
            
            echo ""
            
            # Check disk space
            check_disk_space
            
            echo ""
            
            # Check network
            check_network
            
            echo ""
            
            # Check logs
            local services=$($COMPOSE_CMD -f $COMPOSE_FILE config --services)
            while IFS= read -r service; do
                if [ -n "$service" ]; then
                    check_logs $service
                fi
            done <<< "$services"
            
            echo ""
            
            if [ "$all_healthy" = true ]; then
                print_status $GREEN "🎉 All services are healthy!"
            else
                print_status $YELLOW "⚠️  Some services have issues"
            fi
            ;;
            
        status)
            print_status $BLUE "📊 Checking container status..."
            local services=$($COMPOSE_CMD -f $COMPOSE_FILE config --services)
            while IFS= read -r service; do
                if [ -n "$service" ]; then
                    check_container_status $service
                fi
            done <<< "$services"
            ;;
            
        endpoints)
            print_status $BLUE "🌐 Checking service endpoints..."
            check_service_endpoint "frontend" "/health" "${FRONTEND_PORT:-3000}"
            check_service_endpoint "backend" "/api/health" "${BACKEND_PORT:-9753}"
            ;;
            
        resources)
            check_resource_usage
            ;;
            
        disk)
            check_disk_space
            ;;
            
        network)
            check_network
            ;;
            
        logs)
            local service=$2
            if [ -z "$service" ]; then
                print_status $RED "❌ Service name is required for logs command"
                echo "Usage: $0 logs <service>"
                exit 1
            fi
            check_logs $service
            ;;
            
        show)
            local service=$2
            if [ -z "$service" ]; then
                print_status $RED "❌ Service name is required for show command"
                echo "Usage: $0 show <service>"
                exit 1
            fi
            show_logs $service
            ;;
            
        cleanup)
            cleanup
            ;;
            
        help)
            show_help
            ;;
            
        *)
            print_status $RED "❌ Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"