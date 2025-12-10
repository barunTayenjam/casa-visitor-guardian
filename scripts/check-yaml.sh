#!/bin/bash

# Simple YAML syntax checker for Docker Compose files
# This checks for common YAML syntax issues

check_yaml_file() {
    local file="$1"
    local errors=0
    
    echo "Checking $file..."
    
    # Check for proper indentation (2 spaces)
    if grep -P '^\t' "$file" >/dev/null; then
        echo "  ❌ Contains tab characters"
        ((errors++))
    fi
    
    # Check for inconsistent indentation
    if grep -P '^ {1,3}[^ ]' "$file" >/dev/null; then
        echo "  ❌ Inconsistent indentation (should be 0, 2, 4, 6... spaces)"
        ((errors++))
    fi
    
    # Check for missing colons after keys
    if grep -P '^[a-zA-Z_][a-zA-Z0-9_]*[ \t]*$' "$file" >/dev/null; then
        echo "  ❌ Missing colon after key"
        ((errors++))
    fi
    
    # Check for proper list syntax
    if grep -P '^[ \t]*-[^ ]' "$file" >/dev/null; then
        echo "  ❌ List items need space after hyphen"
        ((errors++))
    fi
    
    # Check for unquoted special characters
    if grep -P '^[ \t]*[a-zA-Z_][a-zA-Z0-9_]*[ \t]*:[^ \t].*[{}[\]|>]' "$file" >/dev/null; then
        echo "  ⚠️  Possible unquoted special characters"
    fi
    
    # Check for proper environment variable syntax
    if grep -P '\$\{[^}]*$' "$file" >/dev/null; then
        echo "  ❌ Unclosed environment variable"
        ((errors++))
    fi
    
    if [ $errors -eq 0 ]; then
        echo "  ✅ Syntax looks good"
        return 0
    else
        echo "  ❌ Found $errors syntax issues"
        return 1
    fi
}

# Check all compose files
for file in docker-compose*.yml; do
    if [ -f "$file" ]; then
        check_yaml_file "$file"
        echo
    fi
done