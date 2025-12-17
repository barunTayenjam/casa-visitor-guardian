#!/bin/bash

# ===========================================
# SentryVision Deployment Script for Manjaro Server
# ===========================================

set -e  # Exit on any error

# Configuration
SERVER_USER="your_username"  # CHANGE THIS to your server username
SERVER_HOST="your_server_ip"  # CHANGE THIS to your server IP/hostname
SERVER_PATH="/opt/sentryvision"  # Deployment path on server
LOCAL_PATH="$(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v rsync &> /dev/null; then
        log_error "rsync is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        log_error "ssh is not installed. Please install it first."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Validate configuration
validate_config() {
    log_info "Validating configuration..."
    
    if [[ "$SERVER_USER" == "your_username" ]]; then
        log_error "Please update SERVER_USER in the script"
        exit 1
    fi
    
    if [[ "$SERVER_HOST" == "your_server_ip" ]]; then
        log_error "Please update SERVER_HOST in the script"
        exit 1
    fi
    
    log_success "Configuration is valid"
}

# Test SSH connection
test_ssh_connection() {
    log_info "Testing SSH connection to $SERVER_USER@$SERVER_HOST..."
    
    if ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" "echo 'Connection successful'" 2>/dev/null; then
        log_success "SSH connection test passed"
    else
        log_error "SSH connection failed. Please check:"
        log_error "1. Server is accessible"
        log_error "2. SSH keys are set up correctly"
        log_error "3. User permissions are correct"
        exit 1
    fi
}

# Create rsync exclude file
create_exclude_file() {
    log_info "Creating rsync exclude file..."
    
    cat > /tmp/rsync-exclude.txt << EOF
# Git
.git/
.gitignore

# Node modules
node_modules/
*/node_modules/

# Logs
*.log
logs/
*/logs/

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Build artifacts
dist/
build/
*/dist/
*/build/

# Environment files
.env.local
.env.development.local
.env.test.local
.env.production.local

# Docker
.dockerignore

# Temporary files
tmp/
temp/
*.tmp

# Test data
test-data/

# Cache
.cache/
.npm/
.yarn/
.pnpm-store/
EOF
    
    log_success "Exclude file created"
}

# Sync files to server
sync_files() {
    log_info "Syncing files to server..."
    log_info "Source: $LOCAL_PATH"
    log_info "Destination: $SERVER_USER@$SERVER_HOST:$SERVER_PATH"
    
    # Create remote directory if it doesn't exist
    ssh "$SERVER_USER@$SERVER_HOST" "sudo mkdir -p $SERVER_PATH && sudo chown $SERVER_USER:$SERVER_USER $SERVER_PATH"
    
    # Sync files with progress
    rsync -avz --progress \
        --exclude-from=/tmp/rsync-exclude.txt \
        --delete \
        -e "ssh" \
        "$LOCAL_PATH/" \
        "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"
    
    if [ $? -eq 0 ]; then
        log_success "Files synced successfully"
    else
        log_error "File sync failed"
        exit 1
    fi
}

# Install Docker on server if needed
setup_docker() {
    log_info "Setting up Docker on server..."
    
    ssh "$SERVER_USER@$SERVER_HOST" << 'EOF'
# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    
    # Update package index
    sudo pacman -Sy
    
    # Install Docker
    sudo pacman -S --noconfirm docker docker-compose
    
    # Start and enable Docker service
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    echo "Docker installed successfully"
    echo "Please log out and log back in to apply docker group changes"
else
    echo "Docker is already installed"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo pacman -S --noconfirm docker-compose
else
    echo "Docker Compose is already installed"
fi
EOF
    
    log_success "Docker setup completed"
}

# Build and test containers
build_containers() {
    log_info "Building containers on server..."
    
    ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && docker-compose -f docker-compose.prod.yml build --no-cache"
    
    if [ $? -eq 0 ]; then
        log_success "Containers built successfully"
    else
        log_error "Container build failed"
        exit 1
    fi
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    ssh "$SERVER_USER@$SERVER_HOST" << EOF
cd $SERVER_PATH

echo "Checking Docker images..."
docker images | grep home-security

echo "Checking docker-compose configuration..."
docker-compose -f docker-compose.prod.yml config

echo "Testing frontend build..."
docker-compose -f docker-compose.prod.yml run --rm frontend nginx -t

echo "Testing backend build..."
docker-compose -f docker-compose.prod.yml run --rm backend npm --version
EOF
    
    log_success "Health checks completed"
}

# Cleanup
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/rsync-exclude.txt
    log_success "Cleanup completed"
}

# Main execution
main() {
    echo "=========================================="
    echo "SentryVision Deployment to Manjaro Server"
    echo "=========================================="
    echo ""
    
    check_dependencies
    validate_config
    test_ssh_connection
    create_exclude_file
    sync_files
    setup_docker
    build_containers
    run_health_checks
    cleanup
    
    echo ""
    echo "=========================================="
    log_success "Deployment completed successfully!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. SSH into your server: ssh $SERVER_USER@$SERVER_HOST"
    echo "2. Navigate to project: cd $SERVER_PATH"
    echo "3. Start services: docker-compose -f docker-compose.prod.yml up -d"
    echo "4. Check status: docker-compose -f docker-compose.prod.yml ps"
    echo ""
    echo "Access your application at: http://$SERVER_HOST"
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"