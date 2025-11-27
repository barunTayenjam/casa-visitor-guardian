#!/bin/bash

# SentryVision Deployment Script
# Usage: ./deploy-to-server.sh <server-ip> [user] [destination-path]

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

# Function to show usage
show_usage() {
    echo "SentryVision Deployment Script"
    echo ""
    echo "Usage: $0 <server-ip> [user] [destination-path]"
    echo ""
    echo "Arguments:"
    echo "  server-ip        Target server IP address (required)"
    echo "  user             SSH user (default: current user)"
    echo "  destination-path Deployment path on server (default: /opt/sentryvision)"
    echo ""
    echo "Examples:"
    echo "  $0 192.168.1.100"
    echo "  $0 192.168.1.100 ubuntu"
    echo "  $0 192.168.1.100 ubuntu /home/ubuntu/sentryvision"
    echo ""
    echo "Environment Variables:"
    echo "  SSH_KEY          Path to SSH private key (default: ~/.ssh/id_rsa)"
    echo "  SSH_PORT         SSH port (default: 22)"
    echo "  RSYNC_OPTIONS    Additional rsync options"
    echo ""
}

# Parse arguments
if [ $# -lt 1 ]; then
    print_error "Server IP is required"
    show_usage
    exit 1
fi

SERVER_IP="$1"
SSH_USER="${2:-$(whoami)}"
DEST_PATH="${3:-/opt/sentryvision}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
SSH_PORT="${SSH_PORT:-22}"

# Validate server IP
if [[ ! "$SERVER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && [[ ! "$SERVER_IP" =~ ^[a-zA-Z0-9.-]+$ ]]; then
    print_error "Invalid server IP or hostname: $SERVER_IP"
    exit 1
fi

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    print_warning "SSH key not found at $SSH_KEY, trying password authentication"
    SSH_CMD="ssh -p $SSH_PORT"
else
    SSH_CMD="ssh -i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no"
fi

# Rsync command with SSH
RSYNC_CMD="rsync -avz --progress --delete -e \"$SSH_CMD\""

print_status "Deploying SentryVision to server..."
print_status "Server: $SSH_USER@$SERVER_IP:$DEST_PATH"
print_status "SSH Port: $SSH_PORT"
print_status "SSH Key: $SSH_KEY"

# Test SSH connection
print_status "Testing SSH connection..."
if ! $SSH_CMD "$SSH_USER@$SERVER_IP" "echo 'SSH connection successful'" > /dev/null 2>&1; then
    print_error "Cannot connect to server $SSH_USER@$SERVER_IP"
    print_error "Please check:"
    print_error "  - Server IP and user are correct"
    print_error "  - SSH key is properly configured"
    print_error "  - Server is accessible"
    exit 1
fi
print_success "SSH connection successful"

# Create destination directory and set up structure
print_status "Setting up destination directory..."
$SSH_CMD "$SSH_USER@$SERVER_IP" "
    # Create main directory
    sudo mkdir -p $DEST_PATH
    
    # Create data directories (preserve if exists)
    sudo mkdir -p $DEST_PATH/logs/{postgres,redis,backend}
    sudo mkdir -p $DEST_PATH/data/{uploads,snapshots,events}
    sudo mkdir -p $DEST_PATH/database/init
    
    # Set ownership
    sudo chown -R $SSH_USER:$SSH_USER $DEST_PATH 2>/dev/null || true
    
    # Create .env.local if it doesn't exist
    if [ ! -f $DEST_PATH/.env.local ]; then
        touch $DEST_PATH/.env.local
    fi
    
    echo 'Directory structure created'
"
print_success "Destination directory prepared"

# Backup existing data if this is an update
print_status "Checking for existing installation..."
if $SSH_CMD "$SSH_USER@$SERVER_IP" "test -d $DEST_PATH && test -f $DEST_PATH/docker-compose.all-services.yml"; then
    print_warning "Existing installation found. Backing up data..."
    
    # Create backup directory with timestamp
    BACKUP_DIR="$DEST_PATH.backup.$(date +%Y%m%d_%H%M%S)"
    $SSH_CMD "$SSH_USER@$SERVER_IP" "
        sudo mkdir -p $BACKUP_DIR
        
        # Backup important data
        if [ -d $DEST_PATH/data ]; then
            sudo cp -r $DEST_PATH/data $BACKUP_DIR/ 2>/dev/null || true
        fi
        
        if [ -d $DEST_PATH/logs ]; then
            sudo cp -r $DEST_PATH/logs $BACKUP_DIR/ 2>/dev/null || true
        fi
        
        if [ -f $DEST_PATH/.env.local ]; then
            sudo cp $DEST_PATH/.env.local $BACKUP_DIR/ 2>/dev/null || true
        fi
        
        echo 'Backup completed: $BACKUP_DIR'
    "
    print_success "Data backed up to $BACKUP_DIR"
fi

# Sync production files
print_status "Syncing production files..."

# Define what to exclude
EXCLUDES=(
    '--exclude=node_modules/'
    '--exclude=.git/'
    '--exclude=*.log'
    '--exclude=*.pid'
    '--exclude=.env*'
    '--exclude=dist/'
    '--exclude=build/'
    '--exclude=coverage/'
    '--exclude=.nyc_output/'
    '--exclude=*.tmp'
    '--exclude=*.temp'
    '--exclude=.DS_Store'
    '--exclude=Thumbs.db'
    '--exclude=frontend.log.pid'
    '--exclude=server.log.pid'
    '--exclude=opencv-service.log.pid'
    '--exclude=*.bak'
    '--exclude=*.backup'
)

# Build rsync command
FULL_RSYNC_CMD="$RSYNC_CMD ${EXCLUDES[*]} ./ $SSH_USER@$SERVER_IP:$DEST_PATH/"

print_status "Running rsync command..."
print_status "Command: $FULL_RSYNC_CMD"

# Execute rsync
if eval $FULL_RSYNC_CMD; then
    print_success "Files synced successfully"
else
    print_error "Rsync failed"
    exit 1
fi

# Set up environment file on server
print_status "Setting up environment configuration..."
$SSH_CMD "$SSH_USER@$SERVER_IP" "
    cd $DEST_PATH
    
    # Copy .env.docker to .env.local if it doesn't exist or is empty
    if [ ! -s .env.local ]; then
        cp .env.docker .env.local
        echo 'Created .env.local from .env.docker'
    fi
    
    # Set proper permissions
    chmod 600 .env.local 2>/dev/null || true
    
    # Make scripts executable
    chmod +x start-docker.sh 2>/dev/null || true
    chmod +x scripts/*.sh 2>/dev/null || true
"

print_success "Environment configuration completed"

# Install Docker and Docker Compose if not present
print_status "Checking Docker installation..."
$SSH_CMD "$SSH_USER@$SERVER_IP" "
    # Check if Docker is installed
    if ! command -v docker > /dev/null 2>&1; then
        echo 'Installing Docker...'
        
        # Update package index
        sudo apt-get update
        
        # Install packages to allow apt to use a repository over HTTPS
        sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
        
        # Add Docker's official GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # Set up the stable repository
        echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker Engine
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
        
        # Start and enable Docker
        sudo systemctl start docker
        sudo systemctl enable docker
        
        # Add user to docker group
        sudo usermod -aG docker \$USER
        
        echo 'Docker installed successfully'
    else
        echo 'Docker is already installed'
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        echo 'Installing Docker Compose...'
        
        # Download Docker Compose
        sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
        
        # Apply executable permissions
        sudo chmod +x /usr/local/bin/docker-compose
        
        echo 'Docker Compose installed successfully'
    else
        echo 'Docker Compose is already available'
    fi
"

print_success "Docker setup completed"

# Start the services
print_status "Starting SentryVision services..."
$SSH_CMD "$SSH_USER@$SERVER_IP" "
    cd $DEST_PATH
    
    # Check if user needs to relogin for docker group
    if ! groups \$USER | grep -q docker; then
        echo 'NOTE: You may need to relogin or run: newgrp docker'
        # Use sudo for now
        SUDO_CMD='sudo'
    else
        SUDO_CMD=''
    fi
    
    # Start services
    if [ -f 'start-docker.sh' ]; then
        $SUDO_CMD ./start-docker.sh
    else
        $SUDO_CMD docker compose --env-file .env.local -f docker-compose.all-services.yml up -d
    fi
"

print_success "Services started successfully"

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
$SSH_CMD "$SSH_USER@$SERVER_IP" "
    cd $DEST_PATH
    
    # Wait for PostgreSQL
    echo 'Waiting for PostgreSQL...'
    timeout 60 bash -c 'until docker compose exec -T postgres pg_isready -U \$DB_USER -d \$DB_NAME; do sleep 2; done' 2>/dev/null || echo 'PostgreSQL check timeout'
    
    # Wait for Redis
    echo 'Waiting for Redis...'
    timeout 30 bash -c 'until docker compose exec -T redis redis-cli ping; do sleep 2; done' 2>/dev/null || echo 'Redis check timeout'
    
    # Wait for Backend
    echo 'Waiting for Backend...'
    timeout 60 bash -c 'until curl -f http://localhost:\${BACKEND_PORT:-9753}/api/health; do sleep 5; done' 2>/dev/null || echo 'Backend check timeout'
    
    # Wait for OpenCV
    echo 'Waiting for OpenCV Service...'
    timeout 60 bash -c 'until curl -f http://localhost:\${OPENCV_PORT:-9754}/health; do sleep 5; done' 2>/dev/null || echo 'OpenCV check timeout'
    
    # Wait for Frontend
    echo 'Waiting for Frontend...'
    timeout 60 bash -c 'until curl -f http://localhost:\${FRONTEND_PORT:-3000}; do sleep 5; done' 2>/dev/null || echo 'Frontend check timeout'
    
    echo 'Health checks completed'
"

# Show final status
print_status "Getting service status..."
$SSH_CMD "$SSH_USER@$SERVER_IP" "
    cd $DEST_PATH
    echo '=== Service Status ==='
    docker compose --env-file .env.local -f docker-compose.all-services.yml ps
    
    echo ''
    echo '=== Access URLs ==='
    echo \"Frontend: http://\$(hostname -I | awk '{print \$1}):\${FRONTEND_PORT:-3000}\"
    echo \"Backend API: http://\$(hostname -I | awk '{print \$1}):\${BACKEND_PORT:-9753}\"
    echo \"OpenCV Service: http://\$(hostname -I | awk '{print \$1}):\${OPENCV_PORT:-9754}\"
    echo \"Database: localhost:\${DB_PORT:-5432}\"
    echo \"Redis: localhost:\${REDIS_PORT:-6379}\"
    
    echo ''
    echo '=== Next Steps ==='
    echo '1. Edit environment: cd $DEST_PATH && nano .env.local'
    echo '2. Restart services: cd $DEST_PATH && ./start-docker.sh restart'
    echo '3. View logs: cd $DEST_PATH && ./start-docker.sh logs'
    echo '4. Check status: cd $DEST_PATH && ./start-docker.sh status'
"

print_success "Deployment completed successfully!"
print_status "Deployment Summary:"
print_status "  Server: $SSH_USER@$SERVER_IP"
print_status "  Path: $DEST_PATH"
print_status "  Services: PostgreSQL, Redis, Backend, Frontend, OpenCV"

# Show next steps
echo ""
print_status "Next Steps:"
echo "1. SSH into server: ssh $SSH_USER@$SERVER_IP"
echo "2. Navigate to app: cd $DEST_PATH"
echo "3. Configure environment: nano .env.local"
echo "4. Restart if needed: ./start-docker.sh restart"
echo ""
print_success "SentryVision is now deployed and running!"