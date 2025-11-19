#!/bin/bash

# Make all SentryVision scripts executable
echo "Making SentryVision scripts executable..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Make all scripts executable
chmod +x "$SCRIPT_DIR"/*.sh

echo "✅ Scripts made executable:"
ls -la "$SCRIPT_DIR"/*.sh

echo ""
echo "🚀 SentryVision is now ready for deployment!"
echo ""
echo "Quick start:"
echo "  1. Configure environment:"
echo "     cp .env.example .env.production"
echo "     nano .env.production"
echo ""
echo "  2. Deploy:"
echo "     ./scripts/deploy.sh deploy"
echo ""
echo "  3. Or use interactive console:"
echo "     ./scripts/sentryvision.sh"
echo ""
echo "📖 For full documentation, see:"
echo "   - docs/DEPLOYMENT.md"
echo "   - PHASE7_COMPLETE.md"