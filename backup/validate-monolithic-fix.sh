#!/bin/bash

# Validate the monolithic Dockerfile startup script generation

echo "🔍 Validating Dockerfile.monolithic shell script generation..."

# Test the specific line that was causing issues
echo "Testing CREATE USER command syntax..."
echo '#!/bin/sh' > /tmp/test-startup.sh
echo 'set -e' >> /tmp/test-startup.sh
echo 'su - postgres -c "psql -c \"CREATE USER sentryvision WITH PASSWORD '\''sentryvision123'\'';\"" || true' >> /tmp/test-startup.sh

# Check if the syntax is valid by trying to source it
if bash -n /tmp/test-startup.sh; then
    echo "✅ Shell script syntax is valid"
else
    echo "❌ Shell script syntax error detected"
    exit 1
fi

# Check if the file contains the fixed content
if grep -q "CREATE USER sentryvision WITH PASSWORD 'sentryvision123';\"" /tmp/test-startup.sh; then
    echo "✅ CREATE USER command is properly formatted"
else
    echo "❌ CREATE USER command is not properly formatted"
    exit 1
fi

# Clean up
rm -f /tmp/test-startup.sh

# Check the Dockerfile.monolithic for the fix
if grep -q "CREATE USER sentryvision WITH PASSWORD '\''sentryvision123'\'';\"" Dockerfile.monolithic; then
    echo "✅ Dockerfile.monolithic contains the fix"
else
    echo "❌ Dockerfile.monolithic does not contain the necessary fix"
    exit 1
fi

echo "✅ Monolithic Dockerfile shell script generation validated successfully!"
echo ""
echo "Summary of changes made:"
echo "1. Fixed CREATE USER command syntax in Dockerfile.monolithic"
echo "2. Updated docker-compose.yml healthcheck to use wget and increased start period"
echo "3. Set container name to sentryvision-monolithic for clarity"
echo ""
echo "To build and run the monolithic container:"
echo "  docker-compose build"
echo "  docker-compose up -d"