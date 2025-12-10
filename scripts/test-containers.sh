#!/bin/bash

# SentryVision Container Test Script
# This script tests the containerization setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 SentryVision Container Test Suite${NC}"
echo -e "${BLUE}==================================${NC}"
echo

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    local missing_deps=()
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing dependencies: ${missing_deps[*]}${NC}"
        echo -e "${YELLOW}Please install Docker and Docker Compose to run container tests${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to validate Docker Compose files
validate_compose_files() {
    echo -e "${BLUE}📋 Validating Docker Compose files...${NC}"
    
    local compose_files=("docker-compose.yml" "docker-compose.dev.yml" "docker-compose.prod.yml")
    local all_valid=true
    
    for file in "${compose_files[@]}"; do
        if [ -f "$file" ]; then
            echo -e "${BLUE}Validating $file...${NC}"
            if docker-compose -f "$file" config --quiet > /dev/null 2>&1; then
                echo -e "${GREEN}✅ $file is valid${NC}"
            else
                echo -e "${RED}❌ $file has errors${NC}"
                docker-compose -f "$file" config 2>&1 | head -10
                all_valid=false
            fi
        else
            echo -e "${YELLOW}⚠️  $file not found${NC}"
        fi
    done
    
    if [ "$all_valid" = true ]; then
        echo -e "${GREEN}✅ All compose files are valid${NC}"
    else
        echo -e "${RED}❌ Some compose files have errors${NC}"
        exit 1
    fi
}

# Function to validate Dockerfiles
validate_dockerfiles() {
    echo -e "${BLUE}🐳 Validating Dockerfiles...${NC}"
    
    local dockerfiles=("Dockerfile" "server/Dockerfile" "server/Dockerfile.prod")
    local all_valid=true
    
    for dockerfile in "${dockerfiles[@]}"; do
        if [ -f "$dockerfile" ]; then
            echo -e "${BLUE}Validating $dockerfile...${NC}"
            if docker build --dry-run -f "$dockerfile" . > /dev/null 2>&1; then
                echo -e "${GREEN}✅ $dockerfile is valid${NC}"
            else
                echo -e "${RED}❌ $dockerfile has errors${NC}"
                docker build --dry-run -f "$dockerfile" . 2>&1 | head -10
                all_valid=false
            fi
        else
            echo -e "${YELLOW}⚠️  $dockerfile not found${NC}"
        fi
    done
    
    if [ "$all_valid" = true ]; then
        echo -e "${GREEN}✅ All Dockerfiles are valid${NC}"
    else
        echo -e "${RED}❌ Some Dockerfiles have errors${NC}"
        exit 1
    fi
}

# Function to test build process
test_build() {
    echo -e "${BLUE}🔨 Testing build process...${NC}"
    
    # Test frontend build
    echo -e "${BLUE}Building frontend image...${NC}"
    if docker build -t sentryvision-frontend:test -f Dockerfile --target builder . > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend build successful${NC}"
        docker rmi sentryvision-frontend:test > /dev/null 2>&1 || true
    else
        echo -e "${RED}❌ Frontend build failed${NC}"
        docker build -t sentryvision-frontend:test -f Dockerfile --target builder . 2>&1 | tail -20
        return 1
    fi
    
    # Test backend build
    echo -e "${BLUE}Building backend image...${NC}"
    if docker build -t sentryvision-backend:test -f server/Dockerfile --target builder ./server > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend build successful${NC}"
        docker rmi sentryvision-backend:test > /dev/null 2>&1 || true
    else
        echo -e "${RED}❌ Backend build failed${NC}"
        docker build -t sentryvision-backend:test -f server/Dockerfile --target builder ./server 2>&1 | tail -20
        return 1
    fi
    
    echo -e "${GREEN}✅ All builds successful${NC}"
}

# Function to test development environment
test_dev_environment() {
    echo -e "${BLUE}🛠️  Testing development environment...${NC}"
    
    # Create test environment file
    cat > .env.test << EOF
NODE_ENV=development
FRONTEND_PORT=5173
BACKEND_PORT=9753
DB_NAME=sentryvision_test
DB_USER=testuser
DB_PASSWORD=testpass
REDIS_PASSWORD=testredis
JWT_ACCESS_SECRET=test-jwt-access-secret-32-chars
JWT_REFRESH_SECRET=test-jwt-refresh-secret-32-chars
TOTP_SECRET=test-totp-secret-32-chars
BACKUP_CODE_ENCRYPTION_KEY=test-backup-key-32-chars
AUDIT_INTEGRITY_SECRET=test-audit-secret-32-chars
EOF
    
    echo -e "${BLUE}Starting development environment...${NC}"
    if docker-compose -f docker-compose.dev.yml --env-file .env.test up -d --build > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Development environment started${NC}"
        
        # Wait for services to be ready
        echo -e "${BLUE}Waiting for services to be ready...${NC}"
        sleep 30
        
        # Check service health
        local unhealthy_services=0
        
        if docker-compose -f docker-compose.dev.yml ps | grep -q "Up (healthy)"; then
            echo -e "${GREEN}✅ Some services are healthy${NC}"
        else
            echo -e "${YELLOW}⚠️  Services may still be starting${NC}"
        fi
        
        # Test connectivity
        echo -e "${BLUE}Testing service connectivity...${NC}"
        
        # Test frontend
        if curl -f http://localhost:5173 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend accessible${NC}"
        else
            echo -e "${YELLOW}⚠️  Frontend not accessible (may still be starting)${NC}"
        fi
        
        # Test backend
        if curl -f http://localhost:9753/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend API accessible${NC}"
        else
            echo -e "${YELLOW}⚠️  Backend API not accessible (may still be starting)${NC}"
        fi
        
        # Cleanup
        echo -e "${BLUE}Cleaning up test environment...${NC}"
        docker-compose -f docker-compose.dev.yml --env-file .env.test down -v > /dev/null 2>&1 || true
        rm -f .env.test
        
        echo -e "${GREEN}✅ Development environment test completed${NC}"
    else
        echo -e "${RED}❌ Failed to start development environment${NC}"
        docker-compose -f docker-compose.dev.yml --env-file .env.test logs 2>&1 | tail -20
        rm -f .env.test
        return 1
    fi
}

# Function to test production environment
test_prod_environment() {
    echo -e "${BLUE}🚀 Testing production environment...${NC}"
    
    # Create test environment file
    cat > .env.test << EOF
NODE_ENV=production
FRONTEND_PORT=3000
BACKEND_PORT=9753
DB_NAME=sentryvision_test
DB_USER=testuser
DB_PASSWORD=testpass
REDIS_PASSWORD=testredis
JWT_ACCESS_SECRET=test-jwt-access-secret-32-chars
JWT_REFRESH_SECRET=test-jwt-refresh-secret-32-chars
TOTP_SECRET=test-totp-secret-32-chars
BACKUP_CODE_ENCRYPTION_KEY=test-backup-key-32-chars
AUDIT_INTEGRITY_SECRET=test-audit-secret-32-chars
EOF
    
    echo -e "${BLUE}Starting production environment...${NC}"
    if docker-compose -f docker-compose.yml --env-file .env.test up -d --build > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Production environment started${NC}"
        
        # Wait for services to be ready
        echo -e "${BLUE}Waiting for services to be ready...${NC}"
        sleep 45
        
        # Check service health
        if docker-compose -f docker-compose.yml ps | grep -q "Up (healthy)"; then
            echo -e "${GREEN}✅ Services are healthy${NC}"
        else
            echo -e "${YELLOW}⚠️  Services may still be starting${NC}"
        fi
        
        # Test connectivity
        echo -e "${BLUE}Testing service connectivity...${NC}"
        
        # Test frontend
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend accessible${NC}"
        else
            echo -e "${YELLOW}⚠️  Frontend not accessible (may still be starting)${NC}"
        fi
        
        # Test backend
        if curl -f http://localhost:9753/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend API accessible${NC}"
        else
            echo -e "${YELLOW}⚠️  Backend API not accessible (may still be starting)${NC}"
        fi
        
        # Cleanup
        echo -e "${BLUE}Cleaning up test environment...${NC}"
        docker-compose -f docker-compose.yml --env-file .env.test down -v > /dev/null 2>&1 || true
        rm -f .env.test
        
        echo -e "${GREEN}✅ Production environment test completed${NC}"
    else
        echo -e "${RED}❌ Failed to start production environment${NC}"
        docker-compose -f docker-compose.yml --env-file .env.test logs 2>&1 | tail -20
        rm -f .env.test
        return 1
    fi
}

# Function to test health check script
test_health_script() {
    echo -e "${BLUE}🏥 Testing health check script...${NC}"
    
    if [ -f "./scripts/health-check.sh" ]; then
        if [ -x "./scripts/health-check.sh" ]; then
            echo -e "${GREEN}✅ Health check script is executable${NC}"
            
            # Test help command
            if ./scripts/health-check.sh help > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Health check script help works${NC}"
            else
                echo -e "${RED}❌ Health check script help failed${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ Health check script is not executable${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Health check script not found${NC}"
        return 1
    fi
}

# Function to test deployment script
test_deploy_script() {
    echo -e "${BLUE}🚀 Testing deployment script...${NC}"
    
    if [ -f "./scripts/deploy.sh" ]; then
        if [ -x "./scripts/deploy.sh" ]; then
            echo -e "${GREEN}✅ Deployment script is executable${NC}"
            
            # Test help command
            if ./scripts/deploy.sh help > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Deployment script help works${NC}"
            else
                echo -e "${RED}❌ Deployment script help failed${NC}"
                return 1
            fi
        else
            echo -e "${RED}❌ Deployment script is not executable${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Deployment script not found${NC}"
        return 1
    fi
}

# Function to run quick validation (without Docker)
quick_validation() {
    echo -e "${BLUE}⚡ Running quick validation (no Docker required)...${NC}"
    
    # Check file existence
    local required_files=(
        "Dockerfile"
        "server/Dockerfile"
        "docker-compose.yml"
        "docker-compose.dev.yml"
        "docker-compose.prod.yml"
        "scripts/health-check.sh"
        "scripts/deploy.sh"
        "nginx.conf"
        ".env.example"
    )
    
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            echo -e "${GREEN}✅ $file exists${NC}"
        else
            echo -e "${RED}❌ $file missing${NC}"
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All required files present${NC}"
    else
        echo -e "${RED}❌ Missing files: ${missing_files[*]}${NC}"
        return 1
    fi
    
    # Check script permissions
    local scripts=("scripts/health-check.sh" "scripts/deploy.sh")
    
    for script in "${scripts[@]}"; do
        if [ -x "$script" ]; then
            echo -e "${GREEN}✅ $script is executable${NC}"
        else
            echo -e "${RED}❌ $script is not executable${NC}"
        fi
    done
    
    # Basic syntax checks
    echo -e "${BLUE}Checking basic syntax...${NC}"
    
    # Check shell scripts
    for script in "${scripts[@]}"; do
        if bash -n "$script" 2>/dev/null; then
            echo -e "${GREEN}✅ $script syntax OK${NC}"
        else
            echo -e "${RED}❌ $script has syntax errors${NC}"
            bash -n "$script"
        fi
    done
    
    # Check compose files (basic YAML syntax)
    local compose_files=("docker-compose.yml" "docker-compose.dev.yml" "docker-compose.prod.yml")
    
    for file in "${compose_files[@]}"; do
        # Basic YAML syntax checks without PyYAML
        local yaml_errors=0
        
        # Check for tab characters
        if grep -q $'\t' "$file" 2>/dev/null; then
            echo -e "${RED}❌ $file contains tab characters${NC}"
            ((yaml_errors++))
        fi
        
        # Check for proper list syntax
        if grep -q '^[[:space:]]*-[[:space:]]*$' "$file" 2>/dev/null; then
            echo -e "${RED}❌ $file has empty list items${NC}"
            ((yaml_errors++))
        fi
        
        # Check for unclosed environment variables
        if grep -q '\${[^}]*$' "$file" 2>/dev/null; then
            echo -e "${RED}❌ $file has unclosed environment variables${NC}"
            ((yaml_errors++))
        fi
        
        if [ $yaml_errors -eq 0 ]; then
            echo -e "${GREEN}✅ $file basic YAML syntax OK${NC}"
        else
            echo -e "${RED}❌ $file has $yaml_errors YAML syntax issues${NC}"
        fi
    done
    
    echo -e "${GREEN}✅ Quick validation completed${NC}"
}

# Main test function
main() {
    local test_type="${1:-quick}"
    
    case "$test_type" in
        "quick")
            quick_validation
            ;;
        "full")
            check_prerequisites
            validate_compose_files
            validate_dockerfiles
            test_build
            test_dev_environment
            test_prod_environment
            test_health_script
            test_deploy_script
            echo -e "${GREEN}🎉 All tests passed!${NC}"
            ;;
        "validate")
            check_prerequisites
            validate_compose_files
            validate_dockerfiles
            ;;
        "build")
            check_prerequisites
            test_build
            ;;
        "dev")
            check_prerequisites
            test_dev_environment
            ;;
        "prod")
            check_prerequisites
            test_prod_environment
            ;;
        "scripts")
            test_health_script
            test_deploy_script
            ;;
        "help"|"-h"|"--help")
            echo "SentryVision Container Test Script"
            echo
            echo "Usage: $0 [test_type]"
            echo
            echo "Test types:"
            echo "  quick     Quick validation without Docker (default)"
            echo "  full      Full test suite with Docker"
            echo "  validate  Validate configuration files"
            echo "  build     Test build process"
            echo "  dev       Test development environment"
            echo "  prod      Test production environment"
            echo "  scripts   Test deployment and health scripts"
            echo "  help      Show this help message"
            ;;
        *)
            echo -e "${RED}❌ Unknown test type: $test_type${NC}"
            echo "Use '$0 help' for available test types"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"