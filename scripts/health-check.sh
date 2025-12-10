#!/bin/bash

# SentryVision Container Health Check Script
# This script checks the health of all running containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}
PROJECT_NAME=${COMPOSE_PROJECT_NAME:-sentryvision}

echo -e "${BLUE}🏥 SentryVision Container Health Check${NC}"
echo -e "${BLUE}=====================================${NC}"
echo

# Function to check container health
check_container_health() {
    local container_name=$1
    local service_name=$2
    
    if docker ps --filter "name=${container_name}" --filter "status=running" | grep -q "${container_name}"; then
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "${container_name}" 2>/dev/null || echo "no-healthcheck")
        local status=$(docker inspect --format='{{.State.Status}}' "${container_name}")
        
        case $health_status in
            "healthy")
                echo -e "${GREEN}✅ ${service_name} (${container_name}): Healthy${NC}"
                return 0
                ;;
            "unhealthy")
                echo -e "${RED}❌ ${service_name} (${container_name}): Unhealthy${NC}"
                return 1
                ;;
            "starting")
                echo -e "${YELLOW}🔄 ${service_name} (${container_name}): Starting${NC}"
                return 2
                ;;
            "no-healthcheck")
                if [ "$status" = "running" ]; then
                    echo -e "${GREEN}✅ ${service_name} (${container_name}): Running (no health check)${NC}"
                    return 0
                else
                    echo -e "${RED}❌ ${service_name} (${container_name}): $status${NC}"
                    return 1
                fi
                ;;
        esac
    else
        echo -e "${RED}❌ ${service_name} (${container_name}): Not running${NC}"
        return 1
    fi
}

# Function to check service dependencies
check_dependencies() {
    local service=$1
    echo -e "${BLUE}📋 Checking dependencies for ${service}...${NC}"
    
    # Get service dependencies from docker-compose
    local deps=$(docker-compose -f "$COMPOSE_FILE" config | grep -A 20 " $service:" | grep -A 10 "depends_on:" | grep " - " | sed 's/.*- //' || true)
    
    if [ -n "$deps" ]; then
        echo "Dependencies: $deps"
        for dep in $deps; do
            check_container_health "${PROJECT_NAME}-${dep}" "$dep"
        done
    else
        echo "No dependencies found"
    fi
    echo
}

# Function to show container logs
show_logs() {
    local container_name=$1
    local lines=${2:-20}
    
    echo -e "${BLUE}📄 Last $lines lines of logs for ${container_name}:${NC}"
    docker logs --tail "$lines" "$container_name" 2>&1 | head -n "$lines"
    echo
}

# Function to show container resource usage
show_resource_usage() {
    echo -e "${BLUE}📊 Container Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" | grep "${PROJECT_NAME}" || echo "No containers found"
    echo
}

# Function to check disk space
check_disk_space() {
    echo -e "${BLUE}💾 Disk Space Usage:${NC}"
    df -h | grep -E "(Filesystem|/dev/)" | head -5
    echo
    
    echo -e "${BLUE}📦 Docker Volume Usage:${NC}"
    docker system df
    echo
}

# Function to check network connectivity
check_network_connectivity() {
    echo -e "${BLUE}🌐 Network Connectivity Check:${NC}"
    
    # Check if containers can communicate
    if docker ps --filter "name=${PROJECT_NAME}-frontend" --filter "status=running" | grep -q "${PROJECT_NAME}-frontend" && \
       docker ps --filter "name=${PROJECT_NAME}-backend" --filter "status=running" | grep -q "${PROJECT_NAME}-backend"; then
        
        echo -e "${GREEN}✅ Frontend and Backend containers are running${NC}"
        
        # Test connectivity from frontend to backend
        if docker exec "${PROJECT_NAME}-frontend" wget -q --spider --timeout=5 http://backend:9753/api/health 2>/dev/null; then
            echo -e "${GREEN}✅ Frontend can reach Backend API${NC}"
        else
            echo -e "${RED}❌ Frontend cannot reach Backend API${NC}"
        fi
    else
        echo -e "${RED}❌ Frontend or Backend containers are not running${NC}"
    fi
    echo
}

# Main health check
main() {
    echo -e "${BLUE}🔍 Checking container status...${NC}"
    echo
    
    # Check all services
    local services=("frontend" "backend" "postgres" "redis")
    local overall_status=0
    
    for service in "${services[@]}"; do
        check_container_health "${PROJECT_NAME}-${service}" "$service" || overall_status=1
    done
    
    echo
    echo -e "${BLUE}🔍 Detailed service checks:${NC}"
    echo
    
    # Check dependencies for critical services
    check_dependencies "frontend"
    check_dependencies "backend"
    
    # Show resource usage
    show_resource_usage
    
    # Check disk space
    check_disk_space
    
    # Check network connectivity
    check_network_connectivity
    
    # Show logs for unhealthy containers
    echo -e "${BLUE}📄 Checking logs for unhealthy containers...${NC}"
    for service in "${services[@]}"; do
        local container_name="${PROJECT_NAME}-${service}"
        if docker ps --filter "name=${container_name}" --filter "status=running" | grep -q "${container_name}"; then
            local health_status=$(docker inspect --format='{{.State.Health.Status}}' "${container_name}" 2>/dev/null || echo "no-healthcheck")
            if [ "$health_status" = "unhealthy" ]; then
                show_logs "$container_name" 10
            fi
        fi
    done
    
    # Summary
    echo -e "${BLUE}📋 Health Check Summary:${NC}"
    if [ $overall_status -eq 0 ]; then
        echo -e "${GREEN}✅ All containers are healthy!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some containers have issues. Please check the output above.${NC}"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-}" in
    "logs")
        if [ -n "${2:-}" ]; then
            show_logs "${PROJECT_NAME}-${2}" "${3:-20}"
        else
            echo "Usage: $0 logs <service> [lines]"
            echo "Available services: frontend, backend, postgres, redis"
            exit 1
        fi
        ;;
    "stats")
        show_resource_usage
        ;;
    "deps")
        if [ -n "${2:-}" ]; then
            check_dependencies "$2"
        else
            echo "Usage: $0 deps <service>"
            echo "Available services: frontend, backend, postgres, redis"
            exit 1
        fi
        ;;
    "disk")
        check_disk_space
        ;;
    "network")
        check_network_connectivity
        ;;
    "help"|"-h"|"--help")
        echo "SentryVision Health Check Script"
        echo
        echo "Usage: $0 [command] [options]"
        echo
        echo "Commands:"
        echo "  (no args)    Run full health check"
        echo "  logs <service> [lines]  Show logs for a service"
        echo "  stats        Show container resource usage"
        echo "  deps <service>       Show dependencies for a service"
        echo "  disk         Check disk space usage"
        echo "  network      Check network connectivity"
        echo "  help         Show this help message"
        echo
        echo "Environment variables:"
        echo "  COMPOSE_FILE        Docker compose file (default: docker-compose.yml)"
        echo "  COMPOSE_PROJECT_NAME Project name (default: sentryvision)"
        ;;
    *)
        main
        ;;
esac