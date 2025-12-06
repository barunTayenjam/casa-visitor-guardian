#!/bin/bash

# SentryVision Manjaro Deployment Script
# This script deploys SentryVision on a Manjaro system using Podman

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

# Check if running on Manjaro
check_system() {
    if ! grep -q "Manjaro" /etc/os-release 2>/dev/null; then
        print_warning "This script is optimized for Manjaro Linux"
        read -p "Do you want to continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    print_success "Running on Manjaro Linux"
}

# Install required packages
install_packages() {
    print_status "Installing required packages..."
    
    # Update package database
    sudo pacman -Syu --noconfirm
    
    # Install core packages
    sudo pacman -S --noconfirm podman podman-compose curl wget openssl npm
    
    # Install optional packages
    sudo pacman -S --noconfirm git lsof htop
    
    print_success "Packages installed successfully"
}

# Configure Podman for user
configure_podman() {
    print_status "Configuring Podman for user $(whoami)..."
    
    # Check if subuid and subgid are configured
    if ! grep -q "$(whoami):" /etc/subuid 2>/dev/null; then
        print_status "Configuring subuid and subgid for user $(whoami)..."
        sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 $(whoami)
    fi
    
    # Enable linger for user (allows services to run after logout)
    print_status "Enabling linger for user $(whoami)..."
    loginctl enable-linger $(whoami)
    
    # Start and enable podman socket
    systemctl --user enable podman.socket
    systemctl --user start podman.socket
    
    # Verify Podman installation
    podman info > /dev/null 2>&1
    print_success "Podman configured successfully"
}

# Setup directories with proper permissions
setup_directories() {
    print_status "Setting up directories..."
    
    # Create directories
    mkdir -p logs/{postgres,redis,backend,nginx}
    mkdir -p data/{uploads,snapshots,events}
    mkdir -p database/{init,migrations}
    
    # Set ownership for rootless Podman
    chown -R $(id -u):$(id -g) logs data database
    chmod -R 755 logs data database
    
    print_success "Directories created with proper permissions"
}

# Configure firewall
configure_firewall() {
    print_status "Configuring firewall..."
    
    # Check if ufw is installed
    if command -v ufw >/dev/null 2>&1; then
        print_status "Configuring UFW firewall..."
        sudo ufw allow 3000/tcp comment "SentryVision Frontend"
        sudo ufw allow 9753/tcp comment "SentryVision Backend"
        sudo ufw allow 9754/tcp comment "SentryVision OpenCV Service"
        
        # Check if ufw is active
        if sudo ufw status | grep -q "Status: active"; then
            print_success "Firewall configured successfully"
        else
            print_warning "Firewall is not active. To enable it, run: sudo ufw enable"
        fi
    else
        print_warning "UFW not found. Please configure your firewall manually to allow ports 3000, 9753, and 9754"
    fi
}

# Generate environment configuration
generate_env() {
    print_status "Generating environment configuration..."
    
    if [ ! -f ".env.docker" ]; then
        # Check if .env.example exists
        if [ -f ".env.example" ]; then
            cp .env.example .env.docker
        elif [ -f ".env.docker.example" ]; then
            cp .env.docker.example .env.docker
        else
            print_error "No environment template found. Please create .env.docker manually"
            exit 1
        fi
        
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
        
        # Get server IP for remote access configuration
        SERVER_IP=$(hostname -I | awk '{print $1}')
        if [ -n "$SERVER_IP" ]; then
            sed -i "s|CORS_ORIGIN=http://localhost:3000|CORS_ORIGIN=http://$SERVER_IP:3000|g" .env.docker
            sed -i "s|FRONTEND_URL=http://localhost:3000|FRONTEND_URL=http://$SERVER_IP:3000|g" .env.docker
            sed -i "s|VITE_BACKEND_URL=http://localhost:9753|VITE_BACKEND_URL=http://$SERVER_IP:9753|g" .env.docker
            print_status "Configured for remote access with IP: $SERVER_IP"
        fi
        
        print_success "Environment configuration generated"
        print_warning "Original .env.docker backed up as .env.docker.bak"
        print_warning "Please review .env.docker and make any additional changes"
    else
        print_status "Environment file already exists"
    fi
}

# Create systemd service
create_service() {
    print_status "Creating systemd service for auto-start..."
    
    SERVICE_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SERVICE_DIR"
    
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

    systemctl --user daemon-reload
    systemctl --user enable sentryvision-podman.service
    
    print_success "Systemd service created and enabled"
}

# Deploy SentryVision
deploy() {
    print_status "Deploying SentryVision..."
    
    # Make scripts executable
    chmod +x start-podman.sh
    
    # Run setup
    ./start-podman.sh setup
    
    # Start services
    ./start-podman.sh start
    
    print_success "SentryVision deployed successfully"
}

# Show deployment summary
show_summary() {
    print_success "Deployment completed successfully!"
    echo ""
    print_status "Deployment Summary:"
    echo "  - SentryVision is running with Podman"
    echo "  - Services are configured to auto-start on boot"
    echo "  - Firewall rules have been configured"
    echo ""
    print_status "Access URLs:"
    
    SERVER_IP=$(hostname -I | awk '{print $1}')
    if [ -n "$SERVER_IP" ]; then
        echo -e "${GREEN}Frontend (Local):${NC} http://localhost:3000"
        echo -e "${GREEN}Frontend (Remote):${NC} http://$SERVER_IP:3000"
        echo -e "${GREEN}Backend API (Local):${NC} http://localhost:9753"
        echo -e "${GREEN}Backend API (Remote):${NC} http://$SERVER_IP:9753"
    else
        echo -e "${GREEN}Frontend:${NC} http://localhost:3000"
        echo -e "${GREEN}Backend API:${NC} http://localhost:9753"
    fi
    
    echo -e "${GREEN}OpenCV Service:${NC} http://localhost:9754"
    echo -e "${GREEN}Database:${NC} localhost:5432"
    echo -e "${GREEN}Redis:${NC} localhost:6379"
    echo ""
    print_status "Management Commands:"
    echo "  - Start/Stop: ./start-podman.sh [start|stop|restart]"
    echo "  - View Logs: ./start-podman.sh logs"
    echo "  - Check Status: ./start-podman.sh status"
    echo ""
    print_status "Next Steps:"
    echo "  1. Access the frontend to create an admin account"
    echo "  2. Configure your cameras"
    echo "  3. Test motion detection and streaming"
    echo ""
    print_success "Thank you for choosing SentryVision!"
}

# Main deployment flow
main() {
    print_status "Starting SentryVision deployment on Manjaro..."
    echo ""
    
    check_system
    install_packages
    configure_podman
    setup_directories
    configure_firewall
    generate_env
    create_service
    deploy
    show_summary
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "help"|"-h"|"--help")
        echo "SentryVision Manjaro Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    Deploy SentryVision on Manjaro (default)"
        echo "  help      Show this help message"
        echo ""
        echo "This script will:"
        echo "  - Install required packages (podman, podman-compose, etc.)"
        echo "  - Configure Podman for your user"
        echo "  - Setup necessary directories and permissions"
        echo "  - Configure firewall rules"
        echo "  - Generate secure environment configuration"
        echo "  - Create systemd service for auto-start"
        echo "  - Deploy and start SentryVision"
        ;;
    *)
        print_error "Unknown command: $1"
        print_status "Use '$0 help' for available commands"
        exit 1
        ;;
esac