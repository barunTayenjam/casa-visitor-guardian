#!/bin/bash

# Enhanced Docker Test Script for SentryVision
# This script performs comprehensive Docker testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="${PROJECT_NAME:-sentryvision}"
COMPOSE_FILES="docker-compose.yml docker-compose.dev.yml docker-compose.prod.yml"

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_status $RED "❌ Docker is not installed or not in PATH"
        return 1
    else
        print_status $GREEN "✅ Docker is available: $(docker --version)"
        return 0
    fi
}

# Check if Docker Compose is available
check_docker_compose() {
    local compose_cmd=""
    if command -v docker-compose &> /dev/null; then
        compose_cmd="docker-compose"
        print_status $GREEN "✅ Docker Compose is available: $(docker-compose --version)"
    elif docker compose version &> /dev/null; then
        compose_cmd="docker compose"
        print_status $GREEN "✅ Docker Compose (plugin) is available: $(docker compose version)"
    else
        print_status $RED "❌ Docker Compose is not available"
        return 1
    fi
    echo $compose_cmd
}

# Validate Docker Compose configuration
validate_compose() {
    local compose_file=$1
    local compose_cmd=$2
    
    print_status $BLUE "🔧 Validating $compose_file..."
    if $compose_cmd -f $compose_file config > /dev/null 2>&1; then
        print_status $GREEN "✅ $compose_file is valid"
        return 0
    else
        print_status $RED "❌ $compose_file has errors"
        $compose_cmd -f $compose_file config
        return 1
    fi
}

# Test Docker build
test_build() {
    local compose_file=$1
    local compose_cmd=$2
    
    print_status $BLUE "🏗️  Testing build for $compose_file..."
    if $compose_cmd -f $compose_file build --dry-run > /dev/null 2>&1; then
        print_status $GREEN "✅ Build configuration is valid for $compose_file"
        return 0
    else
        print_status $YELLOW "⚠️  Could not validate build configuration for $compose_file"
        return 1
    fi
}

# Check Dockerfile best practices
check_dockerfile() {
    local dockerfile=$1
    
    print_status $BLUE "📋 Checking $dockerfile best practices..."
    
    local issues=0
    
    # Check for multi-stage build
    if grep -q "FROM.*AS" "$dockerfile"; then
        print_status $GREEN "✅ Uses multi-stage build"
    else
        print_status $YELLOW "⚠️  Consider using multi-stage build"
        ((issues++))
    fi
    
    # Check for non-root user
    if grep -q "USER" "$dockerfile"; then
        print_status $GREEN "✅ Uses non-root user"
    else
        print_status $YELLOW "⚠️  Consider using non-root user"
        ((issues++))
    fi
    
    # Check for health check
    if grep -q "HEALTHCHECK" "$dockerfile"; then
        print_status $GREEN "✅ Has health check"
    else
        print_status $YELLOW "⚠️  Consider adding health check"
        ((issues++))
    fi
    
    # Check for specific version
    if grep -q "FROM.*:" "$dockerfile"; then
        print_status $GREEN "✅ Uses specific version tags"
    else
        print_status $YELLOW "⚠️  Consider using specific version tags"
        ((issues++))
    fi
    
    return $issues
}

# Main execution
main() {
    print_status $BLUE "🚀 Starting Enhanced Docker Testing for SentryVision"
    echo ""
    
    # Check Docker availability
    if ! check_docker; then
        exit 1
    fi
    echo ""
    
    # Check Docker Compose availability
    local compose_cmd=$(check_docker_compose)
    if [ $? -ne 0 ]; then
        exit 1
    fi
    echo ""
    
    # Test each compose file
    local all_valid=true
    for compose_file in $COMPOSE_FILES; do
        if [ -f "$compose_file" ]; then
            if ! validate_compose "$compose_file" "$compose_cmd"; then
                all_valid=false
            fi
            if ! test_build "$compose_file" "$compose_cmd"; then
                all_valid=false
            fi
            echo ""
        else
            print_status $YELLOW "⚠️  $compose_file not found"
        fi
    done
    
    # Check Dockerfiles
    local dockerfiles="Dockerfile server/Dockerfile frontend/Dockerfile.prod"
    for dockerfile in $dockerfiles; do
        if [ -f "$dockerfile" ]; then
            check_dockerfile "$dockerfile"
            echo ""
        fi
    done
    
    # Final status
    if [ "$all_valid" = true ]; then
        print_status $GREEN "🎉 All Docker configurations are valid!"
    else
        print_status $YELLOW "⚠️  Some configurations have issues"
    fi
    
    # Provide next steps
    print_status $BLUE "📝 Next steps:"
    print_status $BLUE "1. Run 'docker-compose -f docker-compose.dev.yml up -d' for development"
    print_status $BLUE "2. Run 'docker-compose -f docker-compose.prod.yml up -d' for production"
    print_status $BLUE "3. Use './scripts/enhanced-health-check.sh' to monitor services"
    print_status $BLUE "4. Check '.env.example' for required environment variables"
}

# Run main function
main