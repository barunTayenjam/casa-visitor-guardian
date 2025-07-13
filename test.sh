#!/bin/bash

# Test script for person detection endpoints
# This script will test various person detection endpoints to identify issues

BASE_URL="http://localhost:9753"
echo "🧪 Testing Person Detection System"
echo "=================================="
echo "Base URL: $BASE_URL"
echo ""

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo "📡 Testing: $description"
    echo "   Method: $method"
    echo "   Endpoint: $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1 | cut -d: -f2)
    body=$(echo "$response" | sed '$d')
    
    echo "   Status: $http_code"
    if [ "$http_code" = "200" ]; then
        echo "   ✅ SUCCESS"
    else
        echo "   ❌ FAILED"
    fi
    echo "   Response: $body"
    echo ""
}

# Test 1: Check if server is running
echo "1. Checking server health..."
test_endpoint "GET" "/api/health" "" "Server Health Check"

# Test 2: Check person detector debug info
echo "2. Checking person detector status..."
test_endpoint "GET" "/api/debug/person-detector" "" "Person Detector Debug Info"

# Test 3: Try to scan snapshots for persons
echo "3. Testing person detection scan..."
test_endpoint "POST" "/api/scan-snapshots-for-persons" "{}" "Scan Snapshots for Persons"

# Test 4: Check cameras
echo "4. Checking cameras..."
test_endpoint "GET" "/api/cameras" "" "Get All Cameras"

# Test 5: Check system settings
echo "5. Checking system settings..."
test_endpoint "GET" "/api/settings" "" "Get System Settings"

# Test 6: Check detected persons
echo "6. Checking detected persons..."
test_endpoint "GET" "/api/detected-persons" "" "Get Detected Persons"

# Test 7: Check batch person detection status
echo "7. Checking batch person detection..."
test_endpoint "GET" "/api/person/batch/status" "" "Batch Person Detection Status"

# Test 8: Try to start batch processing
echo "8. Testing batch processing start..."
batch_data='{"minConfidence": 0.6, "maxDetections": 10, "saveDetectedPersons": true}'
test_endpoint "POST" "/api/person/batch/process" "$batch_data" "Start Batch Processing"

echo "=================================="
echo "🏁 Test completed!"
echo ""
echo "📋 Summary:"
echo "   - If server health fails: Server is not running"
echo "   - If person detector debug shows issues: TensorFlow not loaded"
echo "   - If scan fails with 'not initialized': Person detector setup failed"
echo "   - If batch processing fails: Batch detection service not available"
echo ""
echo "🔧 To start the server:"
echo "   cd server && npm run dev"
echo ""
echo "📁 Check these directories for images:"
echo "   - server/public/events/"
echo "   - server/public/snapshots/"
echo "   - server/public/detected-persons/"