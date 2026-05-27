#!/bin/bash

# SentryVision Script Executor
# Central script for running all SentryVision utilities

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script information
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Display banner
display_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
 ____  _   _ _____     _     _  ____ _     ___  _   _ 
|  _ \| | | |_ _|_   _(_) __| |/ ___| |   |_ _| | | |
| |_) | |_| | | | | | | |  | | |   | |_| | || | | |
|  _ <| '_| | | | | | | |  | | |___|  _  || | | |
|_| \_\_|_|_|___|_| |_|_|_|_|\____|_| |_|___|_|_|_|
                                                        

     Enterprise-Grade Home Security System
EOF
    echo -e "${NC}"
}

# Show main menu
show_main_menu() {
    clear
    display_banner
    echo
    echo -e "${PURPLE}SentryVision Management Console${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
    echo -e "${CYAN}Deployment Options:${NC}"
    echo "  1) Deploy SentryVision"
    echo "  2) Update Deployment"
    echo "  3) Show Service Status"
    echo "  4) Stop All Services"
    echo "  5) Restart All Services"
    echo
    echo -e "${CYAN}Maintenance Options:${NC}"
    echo "  6) Create Backups"
    echo "  7) Restore from Backup"
    echo "  8) Health Check"
    echo "  9) View Logs"
    echo
    echo -e "${CYAN}Configuration Options:${NC}"
    echo " 10) Generate SSL Certificates"
    echo " 11) Setup Monitoring"
    echo " 12) Environment Configuration"
    echo
    echo -e "${CYAN}Utilities:${NC}"
    echo " 13) Database Management"
    echo " 14) User Management"
    echo " 15) Security Audit"
    echo " 16) Performance Analysis"
    echo
    echo -e "${CYAN}Other Options:${NC}"
    echo " 17) Documentation"
    echo " 18) System Information"
    echo " 19) Help"
    echo " 0) Exit"
    echo
    echo -n "${YELLOW}Select an option: ${NC}"
}

# Deploy function
deploy_system() {
    echo -e "${GREEN}Deploying SentryVision...${NC}"
    echo
    
    if [[ ! -f "$SCRIPT_DIR/deploy.sh" ]]; then
        echo -e "${RED}Deployment script not found${NC}"
        return 1
    fi
    
    chmod +x "$SCRIPT_DIR/deploy.sh"
    "$SCRIPT_DIR/deploy.sh" deploy
}

# Update function
update_system() {
    echo -e "${GREEN}Updating SentryVision...${NC}"
    echo
    
    if [[ ! -f "$SCRIPT_DIR/deploy.sh" ]]; then
        echo -e "${RED}Deployment script not found${NC}"
        return 1
    fi
    
    chmod +x "$SCRIPT_DIR/deploy.sh"
    "$SCRIPT_DIR/deploy.sh" update
}

# Show service status
show_status() {
    echo -e "${GREEN}SentryVision Service Status${NC}"
    echo
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        docker-compose -f docker-compose.prod.yml ps
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# Stop services
stop_services() {
    echo -e "${YELLOW}Stopping SentryVision services...${NC}"
    echo
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        docker-compose -f docker-compose.prod.yml down
        echo -e "${GREEN}Services stopped${NC}"
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# Restart services
restart_services() {
    echo -e "${GREEN}Restarting SentryVision services...${NC}"
    echo
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        docker-compose -f docker-compose.prod.yml restart
        echo -e "${GREEN}Services restarted${NC}"
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# Backup menu
backup_menu() {
    echo -e "${GREEN}Backup Management${NC}"
    echo
    echo "1) Database Backup"
    echo "2) Files Backup"
    echo "3) Full Backup (Database + Files)"
    echo "4) List Backups"
    echo "5) Verify Backup"
    echo "6) Back to Main Menu"
    echo
    echo -n "${YELLOW}Select backup option: ${NC}"
    
    read -r choice
    
    if [[ ! -f "$SCRIPT_DIR/backup.sh" ]]; then
        echo -e "${RED}Backup script not found${NC}"
        return 1
    fi
    
    chmod +x "$SCRIPT_DIR/backup.sh"
    
    case $choice in
        1) "$SCRIPT_DIR/backup.sh" database ;;
        2) "$SCRIPT_DIR/backup.sh" files ;;
        3) "$SCRIPT_DIR/backup.sh" all ;;
        4) "$SCRIPT_DIR/backup.sh" list ;;
        5) 
            echo -n "Enter backup file path: "
            read -r backup_file
            "$SCRIPT_DIR/backup.sh" verify "$backup_file"
            ;;
        6) return ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
}

# Restore function
restore_system() {
    echo -e "${GREEN}Restore from Backup${NC}"
    echo
    
    if [[ ! -f "$SCRIPT_DIR/backup.sh" ]]; then
        echo -e "${RED}Backup script not found${NC}"
        return 1
    fi
    
    # List available backups
    "$SCRIPT_DIR/backup.sh" list
    echo
    
    echo -n "Enter backup file path to restore: "
    read -r backup_file
    
    if [[ -n "$backup_file" ]]; then
        chmod +x "$SCRIPT_DIR/backup.sh"
        "$SCRIPT_DIR/backup.sh" restore "$backup_file"
    else
        echo -e "${RED}No backup file specified${NC}"
    fi
}

# Health check
health_check() {
    echo -e "${GREEN}SentryVision Health Check${NC}"
    echo
    
    if [[ ! -f "$SCRIPT_DIR/health.sh" ]]; then
        echo -e "${RED}Health check script not found${NC}"
        return 1
    fi
    
    chmod +x "$SCRIPT_DIR/health.sh"
    "$SCRIPT_DIR/health.sh" check
}

# View logs
view_logs() {
    echo -e "${GREEN}SentryVision Logs${NC}"
    echo
    echo "Select service to view logs:"
    echo "1) All Services"
    echo "2) Backend"
    echo "3) Frontend (Nginx)"
    echo "4) Database"
    echo "5) Redis"
    echo "6) Back to Main Menu"
    echo
    echo -n "${YELLOW}Select service: ${NC}"
    
    read -r choice
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        case $choice in
            1) docker-compose -f docker-compose.prod.yml logs -f ;;
            2) docker-compose -f docker-compose.prod.yml logs -f backend ;;
            3) docker-compose -f docker-compose.prod.yml logs -f nginx ;;
            4) docker-compose -f docker-compose.prod.yml logs -f postgres ;;
            5) docker-compose -f docker-compose.prod.yml logs -f redis ;;
            6) return ;;
            *) echo -e "${RED}Invalid option${NC}" ;;
        esac
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# Generate SSL certificates
generate_ssl() {
    echo -e "${GREEN}SSL Certificate Generation${NC}"
    echo
    
    echo "Select SSL certificate type:"
    echo "1) Self-Signed (Development)"
    echo "2) Let's Encrypt (Production)"
    echo "3) Back to Main Menu"
    echo
    echo -n "${YELLOW}Select option: ${NC}"
    
    read -r choice
    
    case $choice in
        1)
            echo -e "${YELLOW}Generating self-signed certificate...${NC}"
            mkdir -p "$PROJECT_DIR/docker/ssl"
            
            if [[ -f "$PROJECT_DIR/.env.production" ]]; then
                source "$PROJECT_DIR/.env.production"
                domain="${DOMAIN:-localhost}"
            else
                domain="localhost"
            fi
            
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$PROJECT_DIR/docker/ssl/key.pem" \
                -out "$PROJECT_DIR/docker/ssl/cert.pem" \
                -subj "/C=US/ST=State/L=City/O=SentryVision/CN=$domain"
            
            echo -e "${GREEN}Self-signed certificate generated${NC}"
            ;;
        2)
            echo -e "${YELLOW}Let's Encrypt setup requires domain and internet access${NC}"
            echo "Please ensure your domain points to this server."
            echo
            echo -n "Enter your domain: "
            read -r domain
            
            if [[ -n "$domain" ]]; then
                sudo apt-get update
                sudo apt-get install -y certbot python3-certbot-nginx
                sudo certbot --nginx -d "$domain" -d "www.$domain"
                echo -e "${GREEN}Let's Encrypt certificate obtained${NC}"
            else
                echo -e "${RED}No domain specified${NC}"
            fi
            ;;
        3) return ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
}

# Setup monitoring
setup_monitoring() {
    echo -e "${GREEN}Monitoring Setup${NC}"
    echo
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        
        echo "Deploying monitoring stack (Prometheus/Grafana)..."
        docker-compose -f docker-compose.prod.yml --profile monitoring up -d
        
        echo -e "${GREEN}Monitoring services started${NC}"
        echo -e "${CYAN}Access URLs:${NC}"
        echo "  Grafana: http://localhost:3001 (admin:admin)"
        echo "  Prometheus: http://localhost:9090"
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# Environment configuration
configure_environment() {
    echo -e "${GREEN}Environment Configuration${NC}"
    echo
    
    if [[ -f "$PROJECT_DIR/.env.production" ]]; then
        echo "Current environment file: $PROJECT_DIR/.env.production"
        echo
        echo "1) View Environment Variables"
        echo "2) Edit Environment File"
        echo "3) Validate Configuration"
        echo "4) Generate New Secrets"
        echo "5) Back to Main Menu"
        echo
        echo -n "${YELLOW}Select option: ${NC}"
        
        read -r choice
        
        case $choice in
            1) cat "$PROJECT_DIR/.env.production" | grep -v "PASSWORD\|SECRET\|KEY" ;;
            2) nano "$PROJECT_DIR/.env.production" ;;
            3) 
                if [[ -f "$SCRIPT_DIR/deploy.sh" ]]; then
                    echo -e "${YELLOW}Validating environment...${NC}"
                    "$SCRIPT_DIR/deploy.sh" validate
                else
                    echo -e "${RED}Validation script not found${NC}"
                fi
                ;;
            4)
                echo -e "${YELLOW}Generating new secrets...${NC}"
                echo "# Generated secrets - add these to .env.production" > "$PROJECT_DIR/.secrets.tmp"
                echo "JWT_ACCESS_SECRET=$(openssl rand -base64 32)" >> "$PROJECT_DIR/.secrets.tmp"
                echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)" >> "$PROJECT_DIR/.secrets.tmp"
                echo "TOTP_SECRET=$(openssl rand -base64 32)" >> "$PROJECT_DIR/.secrets.tmp"
                echo "BACKUP_CODE_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> "$PROJECT_DIR/.secrets.tmp"
                echo "AUDIT_INTEGRITY_SECRET=$(openssl rand -base64 32)" >> "$PROJECT_DIR/.secrets.tmp"
                echo
                cat "$PROJECT_DIR/.secrets.tmp"
                rm "$PROJECT_DIR/.secrets.tmp"
                ;;
            5) return ;;
            *) echo -e "${RED}Invalid option${NC}" ;;
        esac
    else
        echo -e "${RED}Environment file not found${NC}"
        echo -e "${YELLOW}Please copy .env.example to .env.production${NC}"
    fi
}

# Database management
database_menu() {
    echo -e "${GREEN}Database Management${NC}"
    echo
    echo "1) Connect to Database"
    echo "2) Run Migrations"
    echo "3) Create Database Backup"
    echo "4) Restore Database"
    echo "5) Database Statistics"
    echo "6) Back to Main Menu"
    echo
    echo -n "${YELLOW}Select option: ${NC}"
    
    read -r choice
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        case $choice in
            1) 
                source "$PROJECT_DIR/.env.production"
                docker-compose -f docker-compose.prod.yml exec postgres psql -U "$DB_USER" "$DB_NAME"
                ;;
            2) 
                docker-compose -f docker-compose.prod.yml run --rm backend npm run migrate
                ;;
            3) 
                if [[ -f "$SCRIPT_DIR/backup.sh" ]]; then
                    "$SCRIPT_DIR/backup.sh" database
                fi
                ;;
            4) 
                if [[ -f "$SCRIPT_DIR/backup.sh" ]]; then
                    "$SCRIPT_DIR/backup.sh" list
                    echo -n "Enter backup file: "
                    read -r backup_file
                    "$SCRIPT_DIR/backup.sh" restore "$backup_file"
                fi
                ;;
            5)
                source "$PROJECT_DIR/.env.production"
                docker-compose -f docker-compose.prod.yml exec postgres psql -U "$DB_USER" "$DB_NAME" -c "
                    SELECT 
                        schemaname,
                        tablename,
                        attname,
                        n_distinct,
                        correlation
                    FROM pg_stats 
                    ORDER BY schemaname, tablename;
                "
                ;;
            6) return ;;
            *) echo -e "${RED}Invalid option${NC}" ;;
        esac
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# User management
user_management() {
    echo -e "${GREEN}User Management${NC}"
    echo
    echo "1) List Users"
    echo "2) Create Admin User"
    echo "3) Reset User Password"
    echo "4) Disable User"
    echo "5) Enable User"
    echo "6) Back to Main Menu"
    echo
    echo -n "${YELLOW}Select option: ${NC}"
    
    read -r choice
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        case $choice in
            1) 
                docker-compose -f docker-compose.prod.yml exec backend npm run users:list
                ;;
            2) 
                docker-compose -f docker-compose.prod.yml exec backend npm run seed:admin
                ;;
            3) 
                echo -n "Enter username: "
                read -r username
                echo -n "Enter new password: "
                read -s password
                docker-compose -f docker-compose.prod.yml exec backend npm run users:reset-password "$username" "$password"
                ;;
            4) 
                echo -n "Enter username to disable: "
                read -r username
                docker-compose -f docker-compose.prod.yml exec backend npm run users:disable "$username"
                ;;
            5) 
                echo -n "Enter username to enable: "
                read -r username
                docker-compose -f docker-compose.prod.yml exec backend npm run users:enable "$username"
                ;;
            6) return ;;
            *) echo -e "${RED}Invalid option${NC}" ;;
        esac
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# Security audit
security_audit() {
    echo -e "${GREEN}Security Audit${NC}"
    echo
    
    echo "Running security checks..."
    echo
    
    # Check for exposed ports
    echo -e "${CYAN}Checking exposed ports...${NC}"
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        docker-compose -f docker-compose.prod.yml ps | grep "Up" | awk '{print $6, $7}'
    fi
    
    # Check SSL certificates
    echo
    echo -e "${CYAN}Checking SSL certificates...${NC}"
    if [[ -f "$PROJECT_DIR/docker/ssl/cert.pem" ]]; then
        openssl x509 -in "$PROJECT_DIR/docker/ssl/cert.pem" -noout -dates
    else
        echo -e "${RED}No SSL certificate found${NC}"
    fi
    
    # Check environment variables
    echo
    echo -e "${CYAN}Checking environment security...${NC}"
    if [[ -f "$PROJECT_DIR/.env.production" ]]; then
        # Check for default passwords
        if grep -q "admin123\|password123\|changeme" "$PROJECT_DIR/.env.production"; then
            echo -e "${RED}⚠️  Default passwords detected in environment file${NC}"
        else
            echo -e "${GREEN}✅ No default passwords found${NC}"
        fi
        
        # Check for weak secrets
        if grep -q "SECRET=\|KEY=" "$PROJECT_DIR/.env.production" | grep -q "test\|dev\|demo"; then
            echo -e "${RED}⚠️  Test/development secrets found${NC}"
        else
            echo -e "${GREEN}✅ No test secrets found${NC}"
        fi
    fi
    
    # Check for common vulnerabilities
    echo
    echo -e "${CYAN}Checking for common vulnerabilities...${NC}"
    
    # Check Docker images for known vulnerabilities
    if command -v docker &> /dev/null; then
        echo "Scanning Docker images for vulnerabilities..."
        docker images --format "table {{.Repository}}:{{.Tag}}" sentryvision | while read image; do
            if [[ "$image" != *"REPOSITORY"* ]]; then
                echo "Scanning $image..."
                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                    aquasec/trivy image "$image" 2>/dev/null || echo "  Vulnerability scan failed"
            fi
        done
    fi
    
    echo
    echo -e "${GREEN}Security audit completed${NC}"
}

# Performance analysis
performance_analysis() {
    echo -e "${GREEN}Performance Analysis${NC}"
    echo
    
    # System resources
    echo -e "${CYAN}System Resources:${NC}"
    echo "CPU: $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')% used"
    echo "Memory: $(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}') used"
    echo "Disk: $(df / | awk 'NR==2 {print $5}') used"
    echo
    
    # Docker container stats
    if command -v docker &> /dev/null; then
        echo -e "${CYAN}Docker Container Stats:${NC}"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
        echo
    fi
    
    # Application performance
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        cd "$PROJECT_DIR"
        echo -e "${CYAN}Application Performance:${NC}"
        
        # Database performance
        echo "Database Connections:"
        if [[ -f "$PROJECT_DIR/.env.production" ]]; then
            source "$PROJECT_DIR/.env.production"
            docker-compose -f docker-compose.prod.yml exec postgres psql -U "$DB_USER" "$DB_NAME" -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "  Unable to connect to database"
        fi
        
        # Response time test
        echo "Application Response Time:"
        if [[ -f "$PROJECT_DIR/.env.production" ]]; then
            source "$PROJECT_DIR/.env.production"
            domain="${DOMAIN:-localhost}"
            if command -v curl &> /dev/null; then
                response_time=$(curl -o /dev/null -s -w '%{time_total}' "https://$domain/health" 2>/dev/null || echo "N/A")
                echo "  Health endpoint: ${response_time}s"
            fi
        fi
    fi
    
    echo
    echo -e "${GREEN}Performance analysis completed${NC}"
}

# Documentation
show_documentation() {
    echo -e "${GREEN}SentryVision Documentation${NC}"
    echo
    echo "Available Documentation:"
    echo "1) Deployment Guide"
    echo "2) API Documentation"
    echo "3) Configuration Reference"
    echo "4) Troubleshooting Guide"
    echo "5) Security Best Practices"
    echo "6) Back to Main Menu"
    echo
    echo -n "${YELLOW}Select documentation: ${NC}"
    
    read -r choice
    
    case $choice in
        1) 
            if [[ -f "$PROJECT_DIR/docs/DEPLOYMENT.md" ]]; then
                less "$PROJECT_DIR/docs/DEPLOYMENT.md"
            else
                echo -e "${RED}Deployment guide not found${NC}"
            fi
            ;;
        2) 
            if [[ -f "$PROJECT_DIR/docs/API.md" ]]; then
                less "$PROJECT_DIR/docs/API.md"
            else
                echo -e "${RED}API documentation not found${NC}"
            fi
            ;;
        3) 
            if [[ -f "$PROJECT_DIR/.env.example" ]]; then
                less "$PROJECT_DIR/.env.example"
            else
                echo -e "${RED}Configuration reference not found${NC}"
            fi
            ;;
        4) 
            if [[ -f "$PROJECT_DIR/docs/DEPLOYMENT.md" ]]; then
                echo -e "${YELLOW}Opening deployment guide to troubleshooting section...${NC}"
                # Could use grep to find troubleshooting section
                less "$PROJECT_DIR/docs/DEPLOYMENT.md"
            else
                echo -e "${RED}Troubleshooting guide not found${NC}"
            fi
            ;;
        5) 
            if [[ -f "$PROJECT_DIR/docs/PHASE7_COMPLETION.md" ]]; then
                less "$PROJECT_DIR/docs/PHASE7_COMPLETION.md"
            else
                echo -e "${RED}Security documentation not found${NC}"
            fi
            ;;
        6) return ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
}

# System information
show_system_info() {
    echo -e "${GREEN}SentryVision System Information${NC}"
    echo
    
    echo -e "${CYAN}System Information:${NC}"
    echo "OS: $(uname -s)"
    echo "Kernel: $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "Hostname: $(hostname)"
    echo "Uptime: $(uptime -p 2>/dev/null || uptime)"
    echo
    
    echo -e "${CYAN}Hardware Information:${NC}"
    echo "CPU Cores: $(nproc)"
    echo "Total Memory: $(free -h | awk '/^Mem:/ {print $2}')"
    echo "Available Memory: $(free -h | awk '/^Mem:/ {print $7}')"
    echo "Total Disk Space: $(df -h / | awk 'NR==2 {print $2}')"
    echo "Available Disk Space: $(df -h / | awk 'NR==2 {print $4}')"
    echo
    
    echo -e "${CYAN}Docker Information:${NC}"
    if command -v docker &> /dev/null; then
        echo "Docker Version: $(docker --version | awk '{print $3}' | sed 's/,//')"
        echo "Docker Compose Version: $(docker-compose --version | awk '{print $3}' | sed 's/,//')"
        echo "Running Containers: $(docker ps -q | wc -l)"
        echo "Total Containers: $(docker ps -a -q | wc -l)"
        echo
    else
        echo -e "${RED}Docker not installed${NC}"
        echo
    fi
    
    echo -e "${CYAN}SentryVision Information:${NC}"
    if [[ -f "$PROJECT_DIR/package.json" ]]; then
        echo "Version: $(grep '"version"' "$PROJECT_DIR/package.json" | cut -d'"' -f4)"
    fi
    
    if [[ -f "$PROJECT_DIR/.env.production" ]]; then
        echo "Environment File: $PROJECT_DIR/.env.production"
        source "$PROJECT_DIR/.env.production"
        echo "Domain: ${DOMAIN:-Not configured}"
        echo "Database: ${DB_NAME}"
        echo "Redis: ${REDIS_HOST}:${REDIS_PORT:-6379}"
    fi
    
    if [[ -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        echo "Docker Compose: $PROJECT_DIR/docker-compose.prod.yml"
        
        cd "$PROJECT_DIR"
        echo "Services: $(docker-compose -f docker-compose.prod.yml config --services | wc -l)"
        
        # Show service status
        echo
        echo -e "${CYAN}Service Status:${NC}"
        docker-compose -f docker-compose.prod.yml ps
    else
        echo -e "${RED}Docker Compose file not found${NC}"
    fi
}

# Help
show_help() {
    echo -e "${GREEN}SentryVision Management Console Help${NC}"
    echo
    echo "This console provides an easy-to-use interface for managing SentryVision."
    echo
    echo -e "${CYAN}Quick Commands:${NC}"
    echo "  deploy.sh        - Deploy or update SentryVision"
    echo "  backup.sh         - Manage backups"
    echo "  health.sh         - Check system health"
    echo
    echo -e "${CYAN}Common Workflows:${NC}"
    echo "  1) First-time deployment: Option 1 (Deploy)"
    echo "  2) Update system: Option 2 (Update)"
    echo "  3) Monitor health: Option 8 (Health Check)"
    echo "  4) Create backup: Option 6 (Create Backups)"
    echo "  5) View logs: Option 9 (View Logs)"
    echo
    echo -e "${CYAN}File Locations:${NC}"
    echo "  Scripts: $SCRIPT_DIR/"
    echo "  Project: $PROJECT_DIR/"
    echo "  Logs: $PROJECT_DIR/logs/"
    echo "  Backups: $PROJECT_DIR/backups/"
    echo
    echo -e "${CYAN}For more help:${NC}"
    echo "  - Read the deployment guide: docs/DEPLOYMENT.md"
    echo "  - View configuration: .env.example"
    echo "  - Check GitHub repository: https://github.com/your-org/sentryvision"
    echo
}

# Main menu loop
main() {
    while true; do
        show_main_menu
        read -r choice
        
        case $choice in
            1) deploy_system ;;
            2) update_system ;;
            3) show_status ;;
            4) stop_services ;;
            5) restart_services ;;
            6) backup_menu ;;
            7) restore_system ;;
            8) health_check ;;
            9) view_logs ;;
            10) generate_ssl ;;
            11) setup_monitoring ;;
            12) configure_environment ;;
            13) database_menu ;;
            14) user_management ;;
            15) security_audit ;;
            16) performance_analysis ;;
            17) show_documentation ;;
            18) show_system_info ;;
            19) show_help ;;
            0) 
                echo -e "${GREEN}Thank you for using SentryVision!${NC}"
                exit 0
                ;;
            *) 
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 2
                ;;
        esac
        
        if [[ $choice -ne 0 ]]; then
            echo
            echo -n "${YELLOW}Press Enter to continue...${NC}"
            read -r
        fi
    done
}

# Check if running with proper arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # If called directly, run main menu
    main
else
    # If sourced, make functions available
    export -f deploy_system update_system show_status stop_services restart_services
    export -f backup_menu restore_system health_check view_logs
    export -f generate_ssl setup_monitoring configure_environment
    export -f database_menu user_management security_audit performance_analysis
    export -f show_documentation show_system_info show_help main
fi