#!/bin/sh
set -e

echo "Starting SentryVision Frontend..."
echo "Environment: $NODE_ENV"
echo "Nginx Port: $NGINX_PORT"
echo "API URL: $API_URL"
echo "WS URL: $WS_URL"

# Create API configuration file for frontend
cat > /usr/share/nginx/html/config.js << EOF
window.SENTRYVISION_CONFIG = {
  API_URL: "${API_URL}",
  WS_URL: "${WS_URL}",
  NODE_ENV: "${NODE_ENV}"
};
EOF

# Start nginx
exec nginx -g "daemon off;"