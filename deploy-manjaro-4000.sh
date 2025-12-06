#!/bin/bash

# SentryVision Manjaro Docker Deployment Script (No Firewall, Port 4000)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if Docker is available
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker > /dev/null 2>&1; then
        print_error "Docker is not installed"
        print_status "Installing Docker..."
        sudo pacman -S --noconfirm docker docker-compose
    fi
    
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Starting Docker..."
        sudo systemctl enable docker
        sudo systemctl start docker
    fi
    
    print_success "Docker is running"
}

# Create environment file
create_env() {
    print_status "Setting up environment..."
    
    if [ ! -f ".env.docker" ]; then
        if [ -f ".env.docker.template" ]; then
            cp .env.docker.template .env.docker
            print_success "Environment file created from template"
        elif [ -f ".env" ]; then
            cp .env .env.docker
            print_success "Environment file copied from .env"
        else
            print_error "No environment file found"
            exit 1
        fi
    else
        print_success "Environment file already exists"
    fi
}

# Deploy SentryVision
deploy() {
    print_status "Deploying SentryVision with Docker..."
    
    # Stop existing containers
    docker-compose --env-file .env.docker down || true
    
    # Start services
    docker-compose --env-file .env.docker -f docker-compose.all-services.yml up -d
    
    print_success "SentryVision deployed successfully"
}

# Show access information
show_access() {
    print_success "Deployment completed!"
    echo ""
    
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    print_status "Access URLs:"
    echo -e "${GREEN}Frontend (Port 4000):${NC} http://localhost:4000"
    if [ -n "$SERVER_IP" ]; then
        echo -e "${GREEN}Frontend (Remote):${NC} http://$SERVER_IP:4000"
    fi
    echo -e "${GREEN}Backend API:${NC} http://localhost:9753"
    echo -e "${GREEN}Database:${NC} localhost:5432"
    echo -e "${GREEN}Redis:${NC} localhost:6379"
    echo ""
    
    print_status "Management Commands:"
    echo "  docker-compose --env-file .env.docker logs"
    echo "  docker-compose --env-file .env.docker ps"
    echo ""
    
    print_success "SentryVision is ready! 🚀"
}

# Main deployment
main() {
    print_status "Starting SentryVision Docker deployment (Port 4000)..."
    echo ""
    
    check_docker
    create_env
    deploy
    show_access
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "stop")
        docker-compose --env-file .env.docker down
        print_success "Services stopped"
        ;;
    "restart")
        docker-compose --env-file .env.docker down
        docker-compose --env-file .env.docker up -d
        print_success "Services restarted"
        ;;
    "logs")
        docker-compose --env-file .env.docker logs -f
        ;;
    "help"|"-h"|"--help")
        echo "SentryVision Manjaro Docker Deployment (Port 4000)"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    Deploy SentryVision (default)"
        echo "  stop      Stop all services"
        echo "  restart   Restart all services"
        echo "  logs      Show service logs"
        echo "  help      Show this help message"
        ;;
    *)
        print_error "Unknown command: $1"
        print_status "Use '$0 help' for available commands"
        exit 1
        ;;
esac