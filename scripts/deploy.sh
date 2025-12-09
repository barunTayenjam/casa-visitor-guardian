#!/bin/bash

# SentryVision Deployment Script
# This script automates the deployment of SentryVision using Docker Compose

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
ENV_FILE="$PROJECT_DIR/.env.production"

# Log functions
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

# Check if running as root (should not be root for Docker)
check_user() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root. Run as a user with Docker access."
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("docker" "docker-compose" "curl" "openssl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Missing dependency: $dep"
            exit 1
        fi
    done
    
    log_success "All dependencies found"
}

# Validate environment file
validate_environment() {
    log_info "Validating environment configuration..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file not found: $ENV_FILE"
        log_info "Please copy .env.example to .env.production and configure it."
        exit 1
    fi
    
    # Load environment variables
    source "$ENV_FILE"
    
    # Check required variables
    local required_vars=(
        "DB_USER" "DB_PASSWORD" "DB_NAME"
        "REDIS_PASSWORD" "JWT_ACCESS_SECRET" "JWT_REFRESH_SECRET"
        "DOMAIN" "TOTP_SECRET" "BACKUP_CODE_ENCRYPTION_KEY"
        "AUDIT_INTEGRITY_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable not set: $var"
            exit 1
        fi
    done
    
    # Validate secrets length
    if [[ ${#JWT_ACCESS_SECRET} -lt 32 ]]; then
        log_error "JWT_ACCESS_SECRET must be at least 32 characters"
        exit 1
    fi
    
    if [[ ${#JWT_REFRESH_SECRET} -lt 32 ]]; then
        log_error "JWT_REFRESH_SECRET must be at least 32 characters"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    local dirs=(
        "logs/nginx" "logs/backend" "logs/postgres" "logs/redis"
        "data/uploads" "data/snapshots" "data/events" "backups"
        "docker/ssl" "docker/prometheus" "docker/grafana"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$PROJECT_DIR/$dir"
    done
    
    log_success "Directories created"
}

# Generate SSL certificates (self-signed for development)
generate_ssl_certificates() {
    log_info "Generating SSL certificates..."
    
    local ssl_dir="$PROJECT_DIR/docker/ssl"
    local cert_file="$ssl_dir/cert.pem"
    local key_file="$ssl_dir/key.pem"
    
    # Check if certificates already exist
    if [[ -f "$cert_file" && -f "$key_file" ]]; then
        log_warning "SSL certificates already exist, skipping generation"
        return
    fi
    
    # Load domain from environment
    source "$ENV_FILE"
    local domain="${DOMAIN:-localhost}"
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$key_file" \
        -out "$cert_file" \
        -subj "/C=US/ST=State/L=City/O=SentryVision/CN=$domain" \
        2>/dev/null
    
    log_success "SSL certificates generated"
    log_warning "Note: Using self-signed certificates. For production, use Let's Encrypt or proper certificates."
}

# Prepare Nginx configuration
prepare_nginx_config() {
    log_info "Preparing Nginx configuration..."
    
    local template_file="$PROJECT_DIR/docker/nginx/default.conf.template"
    local config_file="$PROJECT_DIR/docker/nginx/default.conf"
    
    # Load environment variables
    source "$ENV_FILE"
    local domain="${DOMAIN:-localhost}"
    
    # Replace placeholders in template
    sed "s/\${DOMAIN}/$domain/g" "$template_file" > "$config_file"
    
    log_success "Nginx configuration prepared"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" build --parallel
    
    log_success "Docker images built"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    cd "$PROJECT_DIR"
    
    # Start core services first
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
            break
        fi
        ((attempt++))
        sleep 2
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        log_error "Database failed to become ready"
        exit 1
    fi
    
    log_success "Database is ready"
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" run --rm backend npm run migrate
    
    # Start remaining services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_success "All services started"
}

# Wait for services to be healthy
wait_for_health() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=60
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f http://localhost/health &>/dev/null; then
            log_success "Services are healthy"
            return
        fi
        ((attempt++))
        sleep 5
    done
    
    log_error "Services failed to become healthy within timeout"
    show_service_status
    exit 1
}

# Show service status
show_service_status() {
    log_info "Service status:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Create default admin user
create_admin_user() {
    log_info "Creating default admin user..."
    
    cd "$PROJECT_DIR"
    
    # Check if admin user already exists
    if docker-compose -f "$COMPOSE_FILE" exec -T backend npm run check:admin &>/dev/null; then
        log_warning "Admin user already exists"
        return
    fi
    
    # Create admin user with default credentials
    docker-compose -f "$COMPOSE_FILE" run --rm backend npm run seed:admin
    
    log_success "Default admin user created"
    log_info "Username: admin"
    log_info "Password: admin123 (change this immediately)"
    log_warning "Please change the default admin password immediately!"
}

# Setup monitoring (optional)
setup_monitoring() {
    log_info "Setting up monitoring services..."
    
    read -p "Do you want to enable monitoring (Prometheus/Grafana)? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" --profile monitoring up -d
        log_success "Monitoring services started"
        log_info "Grafana: http://localhost:3001 (admin:admin - change password)"
    else
        log_info "Monitoring skipped"
    fi
}

# Setup backup scripts
setup_backup_scripts() {
    log_info "Setting up backup scripts..."
    
    # Create backup scripts
    local backup_dir="$PROJECT_DIR/scripts"
    mkdir -p "$backup_dir"
    
    # Database backup script
    cat > "$backup_dir/backup-database.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(dirname "$(dirname "$(readlink -f "$0")")")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sentryvision_db_$DATE.sql"

mkdir -p "$BACKUP_DIR"

cd "$PROJECT_DIR"
source .env.production

docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
gzip "$BACKUP_FILE"

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Database backup completed: $BACKUP_FILE.gz"
EOF

    # File backup script
    cat > "$backup_dir/backup-files.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(dirname "$(dirname "$(readlink -f "$0")")")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILE_BACKUP="$BACKUP_DIR/sentryvision_files_$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"

tar -czf "$FILE_BACKUP" \
    "$PROJECT_DIR/data/" \
    "$PROJECT_DIR/logs/" \
    "$PROJECT_DIR/docker/" \
    "$PROJECT_DIR/.env.production"

find "$BACKUP_DIR" -name "*files_*.tar.gz" -mtime +7 -delete

echo "File backup completed: $FILE_BACKUP"
EOF

    # Make scripts executable
    chmod +x "$backup_dir"/*.sh
    
    log_success "Backup scripts created in $backup_dir/"
}

# Setup SSL with Let's Encrypt (optional)
setup_lets_encrypt() {
    log_info "Setting up Let's Encrypt SSL..."
    
    read -p "Do you want to set up Let's Encrypt SSL? (requires domain and internet access) (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Load domain from environment
        source "$ENV_FILE"
        local domain="${DOMAIN}"
        
        if [[ -z "$domain" || "$domain" == "localhost" ]]; then
            log_error "Valid domain required for Let's Encrypt"
            return
        fi
        
        log_info "Installing Certbot..."
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
        
        log_info "Obtaining SSL certificate for $domain..."
        sudo certbot --nginx -d "$domain" -d "www.$domain" --non-interactive --agree-tos --email "admin@$domain"
        
        log_success "Let's Encrypt SSL certificate obtained and installed"
        
        # Setup auto-renewal
        local cron_job="0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx"
        (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
        
        log_info "Auto-renewal scheduled"
    else
        log_info "Let's Encrypt setup skipped"
    fi
}

# Main deployment function
deploy() {
    log_info "Starting SentryVision deployment..."
    
    check_user
    check_dependencies
    validate_environment
    create_directories
    generate_ssl_certificates
    prepare_nginx_config
    build_images
    start_services
    wait_for_health
    show_service_status
    create_admin_user
    setup_monitoring
    setup_backup_scripts
    setup_lets_encrypt
    
    log_success "Deployment completed successfully!"
    
    echo
    echo "=================================="
    echo "  SentryVision Deployment Info"
    echo "=================================="
    echo
    echo "Application URL: https://$DOMAIN"
    echo "Admin Username: admin"
    echo "Admin Password: admin123 (CHANGE THIS!)"
    echo
    echo "Service Status:"
    docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps
    echo
    echo "Useful Commands:"
    echo "  View logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Stop services: docker-compose -f $COMPOSE_FILE down"
    echo "  Restart services: docker-compose -f $COMPOSE_FILE restart"
    echo "  Run backups: $PROJECT_DIR/scripts/backup-database.sh"
    echo
    log_warning "IMPORTANT: Change the default admin password immediately!"
}

# Update function
update() {
    log_info "Updating SentryVision deployment..."
    
    check_dependencies
    
    cd "$PROJECT_DIR"
    
    # Pull latest code
    git pull origin main
    
    # Rebuild and restart
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" build --parallel
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_success "Update completed"
}

# Help function
show_help() {
    cat << EOF
SentryVision Deployment Script

Usage: $0 [COMMAND]

Commands:
    deploy       Deploy SentryVision from scratch
    update       Update existing deployment
    status       Show service status
    logs         Show service logs
    stop         Stop all services
    restart      Restart all services
    backup       Run database backup
    help         Show this help message

Examples:
    $0 deploy
    $0 update
    $0 status

Environment:
    Copy .env.example to .env.production and configure before deploying.
EOF
}

# Command line argument handling
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    update)
        update
        ;;
    status)
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" ps
        ;;
    logs)
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" logs -f
        ;;
    stop)
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" down
        log_info "Services stopped"
        ;;
    restart)
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" restart
        log_info "Services restarted"
        ;;
    backup)
        cd "$PROJECT_DIR"
        ./scripts/backup-database.sh
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac