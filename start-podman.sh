#!/bin/bash

# SentryVision Podman Startup Script
# This script starts all SentryVision microservices using Podman Compose

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
        print_error "Podman is not running or not available. Please start Podman first."
        exit 1
    fi
    print_success "Podman is running"
}

# Function to check if Podman Compose is available
check_podman_compose() {
    if ! command -v podman-compose > /dev/null 2>&1; then
        print_error "Podman Compose is not installed. Please install it first."
        print_status "Install with: pip3 install podman-compose"
        exit 1
    fi
    
    PODMAN_COMPOSE="podman-compose"
    print_success "Podman Compose is available"
}

# Function to check if .env.docker file exists
check_env_file() {
    if [ ! -f ".env.docker" ]; then
        print_warning ".env.docker file not found. Creating from template..."
        cp .env.docker.example .env.docker 2>/dev/null || {
            print_error "Please create .env.docker file from .env.docker.example"
            exit 1
        }
        print_warning "Please edit .env.docker file with your configuration before running again."
        exit 1
    fi
    print_success ".env.docker file found"
}

# Function to generate secure secrets if not set
check_secrets() {
    print_status "Checking security configuration..."
    
    # Check if critical secrets need to be generated
    if grep -q "your-secure-database-password-here-change-this" .env.docker; then
        print_warning "Generating secure passwords and secrets..."
        
        # Generate secure passwords
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        JWT_ACCESS_SECRET=$(openssl rand -base64 32)
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        TOTP_SECRET=$(openssl rand -base64 32)
        BACKUP_CODE_ENCRYPTION_KEY=$(openssl rand -base64 32)
        AUDIT_INTEGRITY_SECRET=$(openssl rand -base64 32)
        
        # Update .env.docker file
        sed -i.bak "s/your-secure-database-password-here-change-this/$DB_PASSWORD/g" .env.docker
        sed -i "s/your-secure-redis-password-here-change-this/$REDIS_PASSWORD/g" .env.docker
        sed -i "s/your-jwt-access-secret-256-bit-here-change-this/$JWT_ACCESS_SECRET/g" .env.docker
        sed -i "s/your-jwt-refresh-secret-256-bit-here-change-this/$JWT_REFRESH_SECRET/g" .env.docker
        sed -i "s/your-totp-secret-256-bit-here-change-this/$TOTP_SECRET/g" .env.docker
        sed -i "s/your-backup-code-encryption-key-here-change-this/$BACKUP_CODE_ENCRYPTION_KEY/g" .env.docker
        sed -i "s/your-audit-integrity-secret-here-change-this/$AUDIT_INTEGRITY_SECRET/g" .env.docker
        
        print_success "Generated secure passwords and secrets"
        print_warning "Original .env.docker backed up as .env.docker.bak"
    fi
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p logs/postgres
    mkdir -p logs/redis
    mkdir -p logs/backend
    mkdir -p data/uploads
    mkdir -p data/snapshots
    mkdir -p data/events
    mkdir -p database/init
    
    # Set ownership for rootless Podman
    if [ "$(id -u)" -ne 0 ]; then
        print_status "Setting permissions for rootless Podman..."
        chown -R $(id -u):$(id -g) logs data database
        chmod -R 755 logs data database
    fi
    
    print_success "Directories created"
}

# Function to start services
start_services() {
    print_status "Starting SentryVision services..."
    
    # Set environment variables
    export COMPOSE_PROJECT_NAME=sentryvision
    
    # Start services
    $PODMAN_COMPOSE --env-file .env.docker -f podman-compose.yml up -d
    
    print_success "Services started successfully"
}

# Function to wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    timeout 60 bash -c 'until $PODMAN_COMPOSE --env-file .env.docker exec -T postgres pg_isready -U $DB_USER -d $DB_NAME; do sleep 2; done'
    
    # Wait for Redis
    print_status "Waiting for Redis..."
    timeout 30 bash -c 'until $PODMAN_COMPOSE --env-file .env.docker exec -T redis redis-cli ping; do sleep 2; done'
    
    # Wait for Backend
    print_status "Waiting for Backend API..."
    timeout 60 bash -c 'until curl -f http://localhost:${BACKEND_PORT:-9753}/api/health; do sleep 5; done'
    
    # Wait for OpenCV Service
    print_status "Waiting for OpenCV Service..."
    timeout 60 bash -c 'until curl -f http://localhost:${OPENCV_PORT:-9754}/health; do sleep 5; done'
    
    # Wait for Frontend
    print_status "Waiting for Frontend..."
    timeout 60 bash -c 'until curl -f http://localhost:${FRONTEND_PORT:-3000}; do sleep 5; done'
    
    print_success "All services are healthy and ready!"
}

# Function to show service status
show_status() {
    print_status "Service Status:"
    $PODMAN_COMPOSE --env-file .env.docker ps
    
    echo ""
    print_status "Access URLs:"
    echo -e "${GREEN}Frontend:${NC} http://localhost:${FRONTEND_PORT:-3000}"
    echo -e "${GREEN}Backend API:${NC} http://localhost:${BACKEND_PORT:-9753}"
    echo -e "${GREEN}OpenCV Service:${NC} http://localhost:${OPENCV_PORT:-9754}"
    echo -e "${GREEN}Database:${NC} localhost:${DB_PORT:-5432}"
    echo -e "${GREEN}Redis:${NC} localhost:${REDIS_PORT:-6379}"
}

# Function to show logs
show_logs() {
    print_status "Showing recent logs..."
    $PODMAN_COMPOSE --env-file .env.docker logs --tail=50
}

# Function to stop services
stop_services() {
    print_status "Stopping SentryVision services..."
    $PODMAN_COMPOSE --env-file .env.docker down
    print_success "Services stopped"
}

# Function to clean up
cleanup() {
    print_status "Cleaning up Podman resources..."
    $PODMAN_COMPOSE --env-file .env.docker down -v --remove-orphans
    podman system prune -f
    print_success "Cleanup completed"
}

# Function to setup rootless Podman
setup_rootless() {
    print_status "Setting up rootless Podman configuration..."
    
    # Check if running as root
    if [ "$(id -u)" -eq 0 ]; then
        print_warning "Running as root. Consider using rootless Podman for better security."
        return 0
    fi
    
    # Setup subuid and subgid if needed
    if ! grep -q "$(id -un):" /etc/subuid 2>/dev/null; then
        print_warning "User $(id -un) not found in /etc/subuid. You may need to configure subuid/subgid."
        print_status "Run: sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 $(id -un)"
    fi
    
    # Check if podman system service is running
    if ! systemctl --user is-active --quiet podman.socket 2>/dev/null; then
        print_status "Starting podman.socket service..."
        systemctl --user enable podman.socket 2>/dev/null || true
        systemctl --user start podman.socket 2>/dev/null || true
    fi
    
    print_success "Rootless Podman setup completed"
}

# Function to create systemd user services for auto-start
create_systemd_services() {
    print_status "Creating systemd user services for auto-start..."
    
    if [ "$(id -u)" -eq 0 ]; then
        print_warning "Running as root. Creating system services instead of user services."
        SERVICE_DIR="/etc/systemd/system"
    else
        SERVICE_DIR="$HOME/.config/systemd/user"
        mkdir -p "$SERVICE_DIR"
    fi
    
    # Generate service files only if they don't exist
    if [ ! -f "$SERVICE_DIR/sentryvision-podman.service" ]; then
        cat > "$SERVICE_DIR/sentryvision-podman.service" << EOF
[Unit]
Description=SentryVision Podman Containers
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=$(which podman-compose) --env-file .env.docker -f podman-compose.yml up -d
ExecStop=$(which podman-compose) --env-file .env.docker -f podman-compose.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

        if [ "$(id -u)" -eq 0 ]; then
            systemctl daemon-reload
            systemctl enable sentryvision-podman.service
            print_success "System service created and enabled"
        else
            systemctl --user daemon-reload
            systemctl --user enable sentryvision-podman.service
            print_success "User service created and enabled"
            print_status "To enable auto-start on login, run: loginctl enable-linger $(id -un)"
        fi
    else
        print_status "Service already exists"
    fi
}

# Main script logic
case "${1:-start}" in
    "setup")
        print_status "Setting up SentryVision Podman environment..."
        setup_rootless
        check_podman
        check_podman_compose
        check_env_file
        check_secrets
        create_directories
        create_systemd_services
        print_success "SentryVision Podman setup completed!"
        ;;
    "start")
        print_status "Starting SentryVision Podman Setup..."
        setup_rootless
        check_podman
        check_podman_compose
        check_env_file
        check_secrets
        create_directories
        start_services
        wait_for_services
        show_status
        print_success "SentryVision is now running with Podman!"
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        sleep 5
        start_services
        wait_for_services
        show_status
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "cleanup")
        cleanup
        ;;
    "service")
        create_systemd_services
        ;;
    "help"|"-h"|"--help")
        echo "SentryVision Podman Management Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup     Set up Podman environment and create systemd services"
        echo "  start     Start all services (default)"
        echo "  stop      Stop all services"
        echo "  restart   Restart all services"
        echo "  status    Show service status"
        echo "  logs      Show recent logs"
        echo "  cleanup   Stop services and clean up Podman resources"
        echo "  service   Create systemd services for auto-start"
        echo "  help      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                # Start all services"
        echo "  $0 start          # Start all services"
        echo "  $0 setup          # Initial setup"
        echo "  $0 stop           # Stop all services"
        echo "  $0 logs           # Show logs"
        ;;
    *)
        print_error "Unknown command: $1"
        print_status "Use '$0 help' for available commands"
        exit 1
        ;;
esac