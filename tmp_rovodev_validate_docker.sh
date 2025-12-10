#!/bin/bash
# Docker Configuration Validation Script for SentryVision

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "SentryVision Docker Validation"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Function to print status
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

check_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 1. Check Docker Files Exist
echo "1. Checking Docker configuration files..."
if [ -f "Dockerfile" ]; then
    check_pass "Frontend Dockerfile exists"
else
    check_fail "Frontend Dockerfile missing"
fi

if [ -f "server/Dockerfile" ]; then
    check_pass "Backend Dockerfile exists"
else
    check_fail "Backend Dockerfile missing"
fi

if [ -f "docker-compose.yml" ]; then
    check_pass "docker-compose.yml exists"
else
    check_fail "docker-compose.yml missing"
fi

if [ -f "docker-compose.prod.yml" ]; then
    check_pass "docker-compose.prod.yml exists"
else
    check_fail "docker-compose.prod.yml missing"
fi

# 2. Check Environment Files
echo ""
echo "2. Checking environment configuration..."
if [ -f ".env" ]; then
    check_pass ".env file exists"
    
    # Check critical env vars
    if grep -q "DB_PASSWORD=test123" .env; then
        check_warn "Using default DB_PASSWORD (change for production)"
    fi
    
    if grep -q "JWT_ACCESS_SECRET=test123" .env; then
        check_warn "Using default JWT_ACCESS_SECRET (change for production)"
    fi
else
    check_fail ".env file missing"
fi

# 3. Check Health Check Endpoints
echo ""
echo "3. Validating health check endpoints..."

# Check server code
if grep -q "app.get('/health'" server/src/index.ts; then
    check_pass "Backend /health endpoint defined"
else
    check_fail "Backend /health endpoint missing"
fi

# Check backend Dockerfile
if grep -q "wget.*localhost:9753/health" server/Dockerfile; then
    check_pass "Backend Dockerfile health check correct"
else
    check_fail "Backend Dockerfile health check incorrect"
fi

# Check docker-compose.yml
if grep -q "http://localhost:9753/health" docker-compose.yml; then
    check_pass "docker-compose.yml backend health check correct"
else
    check_fail "docker-compose.yml backend health check incorrect"
fi

# Check docker-compose.prod.yml
if grep -q "http://localhost:9753/health" docker-compose.prod.yml; then
    check_pass "docker-compose.prod.yml backend health check correct"
else
    check_fail "docker-compose.prod.yml backend health check incorrect"
fi

# 4. Check Package Configuration
echo ""
echo "4. Checking package configuration..."
if grep -q '"type": "module"' server/package.json; then
    check_pass "Backend package.json has type: module"
else
    check_fail "Backend package.json missing type: module"
fi

# 5. Check Build Files
echo ""
echo "5. Checking build configuration..."
if [ -f "server/tsconfig.json" ]; then
    check_pass "Backend tsconfig.json exists"
else
    check_fail "Backend tsconfig.json missing"
fi

if [ -f "vite.config.ts" ]; then
    check_pass "Frontend vite.config.ts exists"
else
    check_fail "Frontend vite.config.ts missing"
fi

# 6. Check Nginx Configuration
echo ""
echo "6. Checking Nginx configuration..."
if [ -f "nginx.conf" ]; then
    check_pass "nginx.conf exists"
else
    check_warn "nginx.conf missing (optional)"
fi

# 7. Check Docker Ignore Files
echo ""
echo "7. Checking .dockerignore files..."
if [ -f ".dockerignore" ]; then
    check_pass "Frontend .dockerignore exists"
else
    check_warn "Frontend .dockerignore missing (optional)"
fi

if [ -f "server/.dockerignore" ]; then
    check_pass "Backend .dockerignore exists"
else
    check_warn "Backend .dockerignore missing (optional)"
fi

# 8. Validate YAML Syntax
echo ""
echo "8. Validating YAML syntax..."
if command -v docker-compose > /dev/null 2>&1; then
    if docker-compose config > /dev/null 2>&1; then
        check_pass "docker-compose.yml syntax valid"
    else
        check_fail "docker-compose.yml syntax invalid"
        docker-compose config 2>&1 | grep -i error | head -3
    fi
    
    if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
        check_pass "docker-compose.prod.yml syntax valid"
    else
        check_warn "docker-compose.prod.yml has warnings"
    fi
else
    check_warn "docker-compose not available, skipping syntax check"
fi

# 9. Check Required Directories
echo ""
echo "9. Checking required directories..."
required_dirs=("server/src" "server/models" "src" "public")
for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        check_pass "Directory $dir exists"
    else
        check_fail "Directory $dir missing"
    fi
done

# 10. Check Documentation
echo ""
echo "10. Checking documentation..."
if [ -f "DOCKER_README.md" ]; then
    check_pass "DOCKER_README.md exists"
else
    check_warn "DOCKER_README.md missing"
fi

if [ -f "DOCKER_FIXES_SUMMARY.md" ]; then
    check_pass "DOCKER_FIXES_SUMMARY.md exists"
else
    check_warn "DOCKER_FIXES_SUMMARY.md missing"
fi

# Summary
echo ""
echo "======================================"
echo "Validation Summary"
echo "======================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Docker configuration is ready for deployment."
    echo ""
    echo "Next steps:"
    echo "  1. Start Docker: colima start (macOS) or sudo systemctl start docker (Linux)"
    echo "  2. Deploy: ./tmp_rovodev_docker_fix.sh"
    echo "  3. Monitor: docker-compose logs -f"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Validation passed with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Docker configuration is functional but has warnings."
    echo "Review warnings above before production deployment."
    exit 0
else
    echo -e "${RED}✗ Validation failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before deployment."
    exit 1
fi
