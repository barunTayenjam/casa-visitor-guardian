#!/bin/bash

# SentryVision Docker Cleanup Script
# Prevents orphaned containers and network conflicts

set -e

echo "🧹 Cleaning up SentryVision Docker resources..."

# Stop and remove all SentryVision containers
echo "Stopping SentryVision containers..."
docker ps -aq --filter "name=sentryvision" | xargs -r docker stop

echo "Removing SentryVision containers..."
docker ps -aq --filter "name=sentryvision" | xargs -r docker rm

# Remove orphaned networks
echo "Removing orphaned SentryVision networks..."
docker network ls --filter "name=sentryvision" --format "{{.Name}}" | xargs -r docker network rm

# Clean up unused volumes (optional - uncomment if needed)
# echo "Cleaning up unused volumes..."
# docker volume prune -f

echo "✅ Cleanup completed successfully!"