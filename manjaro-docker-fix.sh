#!/bin/bash

# SentryVision - Manjaro Docker Fix Script
# This script addresses common Docker issues on Manjaro Linux

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}SentryVision - Manjaro Docker Fix${NC}"
echo "=============================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if user is in docker group
check_docker_group() {
    if groups $USER | grep -q '\bdocker\b'; then
        return 0
    else
        return 1
    fi
}

# 1. Check if Docker is installed
echo -e "\n${YELLOW}1. Checking Docker installation...${NC}"
if command_exists docker; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
    docker --version
else
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker first:"
    echo "sudo pacman -S docker docker-compose"
    exit 1
fi

# 2. Check if Docker service is running
echo -e "\n${YELLOW}2. Checking Docker service status...${NC}"
if systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓ Docker service is running${NC}"
else
    echo -e "${RED}✗ Docker service is not running${NC}"
    echo "Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker
    echo -e "${GREEN}✓ Docker service started and enabled${NC}"
fi

# 3. Check Docker group membership
echo -e "\n${YELLOW}3. Checking Docker group membership...${NC}"
if check_docker_group; then
    echo -e "${GREEN}✓ User is in docker group${NC}"
else
    echo -e "${RED}✗ User is not in docker group${NC}"
    echo "Adding user to docker group..."
    sudo usermod -aG docker $USER
    echo -e "${YELLOW}⚠ You need to log out and log back in for group changes to take effect${NC}"
    echo -e "${YELLOW}⚠ Or run: newgrp docker${NC}"
fi

# 4. Check for port conflicts
echo -e "\n${YELLOW}4. Checking for port conflicts...${NC}"
check_port() {
    local port=$1
    local service_name=$2
    if ss -tuln | grep -q ":$port "; then
        echo -e "${RED}✗ Port $port is already in use${NC}"
        echo "Process using port $port:"
        ss -tulnp | grep ":$port "
        return 1
    else
        echo -e "${GREEN}✓ Port $port is available for $service_name${NC}"
        return 0
    fi
}

PORT_80_AVAILABLE=$(check_port 80 "frontend")
PORT_9753_AVAILABLE=$(check_port 9753 "backend")

# 5. Stop conflicting services if needed
if [ $PORT_80_AVAILABLE -ne 0 ]; then
    echo -e "\n${YELLOW}5. Attempting to resolve port 80 conflict...${NC}"
    # Common services that use port 80
    for service in apache2 httpd nginx lighttpd; do
        if systemctl is-active --quiet $service; then
            echo "Stopping $service..."
            sudo systemctl stop $service
        fi
    done
    
    # Check again
    if ss -tuln | grep -q ":80 "; then
        echo -e "${RED}Port 80 is still in use. You may need to manually stop the service or use different ports.${NC}"
        echo -e "${YELLOW}Consider using docker-compose.dev.yml which uses port 5173 instead of 80${NC}"
    fi
fi

# 6. Check firewall status
echo -e "\n${YELLOW}6. Checking firewall status...${NC}"
if command_exists ufw; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${YELLOW}⚠ UFW firewall is active${NC}"
        echo "You may need to allow Docker ports:"
        echo "sudo ufw allow 80/tcp"
        echo "sudo ufw allow 9753/tcp"
    else
        echo -e "${GREEN}✓ UFW firewall is inactive${NC}"
    fi
elif command_exists firewalld; then
    if systemctl is-active --quiet firewalld; then
        echo -e "${YELLOW}⚠ Firewalld is active${NC}"
        echo "You may need to allow Docker ports:"
        echo "sudo firewall-cmd --permanent --add-port=80/tcp"
        echo "sudo firewall-cmd --permanent --add-port=9753/tcp"
        echo "sudo firewall-cmd --reload"
    else
        echo -e "${GREEN}✓ Firewalld is inactive${NC}"
    fi
else
    echo -e "${GREEN}✓ No common firewall detected${NC}"
fi

# 7. Test Docker functionality
echo -e "\n${YELLOW}7. Testing Docker functionality...${NC}"
if docker run --rm hello-world >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker is working correctly${NC}"
else
    echo -e "${RED}✗ Docker test failed${NC}"
    echo "Try running: sudo docker run --rm hello-world"
    echo "If that works, it's a permissions issue."
fi

# 8. Check available disk space
echo -e "\n${YELLOW}8. Checking disk space...${NC}"
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
if [ $AVAILABLE_SPACE -gt 2097152 ]; then  # 2GB in KB
    echo -e "${GREEN}✓ Sufficient disk space available${NC}"
else
    echo -e "${RED}✗ Low disk space (less than 2GB available)${NC}"
    echo "Docker builds may fail due to insufficient space"
fi

# 9. Clean up Docker if needed
echo -e "\n${YELLOW}9. Docker cleanup (optional)...${NC}"
read -p "Do you want to clean up unused Docker resources? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning up Docker..."
    docker system prune -f
    echo -e "${GREEN}✓ Docker cleanup completed${NC}"
fi

echo -e "\n${BLUE}=============================================="
echo -e "Fix script completed!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. If you were added to the docker group, log out and log back in"
echo "2. Try running the application:"
echo "   For development: docker-compose -f docker-compose.dev.yml up --build"
echo "   For production: docker-compose up --build"
echo -e "\n${YELLOW}If you still have issues, try:${NC}"
echo "- Reboot your system"
echo "- Check Docker logs: journalctl -u docker.service"
echo "- Run with sudo temporarily to test: sudo docker-compose up --build"