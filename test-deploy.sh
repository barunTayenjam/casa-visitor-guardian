#!/bin/bash

# Quick deployment test script
set -e

echo "🚀 Quick Deployment Test for SentryVision"
echo "======================================="

# Configuration - UPDATE THESE VALUES
SERVER_USER="your_username"
SERVER_HOST="your_server_ip" 
SERVER_PATH="/opt/sentryvision"

# Test rsync dry run
echo "📋 Testing rsync configuration..."
rsync --dry-run -avz \
    --exclude-from=/tmp/rsync-exclude.txt \
    -e "ssh" \
    "./" \
    "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/" 2>/dev/null || echo "⚠️  Update SERVER_USER and SERVER_HOST in the script"

echo ""
echo "📝 Next Steps:"
echo "1. Edit deploy-to-manjaro.sh and update SERVER_USER and SERVER_HOST"
echo "2. Run: ./deploy-to-manjaro.sh"
echo "3. Or run manual commands below:"
echo ""
echo "Manual rsync:"
echo "rsync -avz --progress --exclude-from=/tmp/rsync-exclude.txt ./ $SERVER_USER@$SERVER_HOST:$SERVER_PATH/"
echo ""
echo "Manual build:"
echo "ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && docker-compose -f docker-compose.prod.yml build --no-cache'"
echo ""
echo "Manual start:"
echo "ssh $SERVER_USER@$SERVER_HOST 'cd $SERVER_PATH && docker-compose -f docker-compose.prod.yml up -d'"