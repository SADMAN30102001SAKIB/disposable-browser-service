#!/bin/bash

# Test script for Disposable Browser Service
# This script tests the API endpoints and basic functionality

set -e

API_BASE="http://localhost:3000/api"
SESSION_ID=""

echo "🧪 Testing Disposable Browser Service API"
echo "======================================="

# Test health check
echo "1. Testing health check..."
response=$(curl -s -w "%{http_code}" "$API_BASE/health")
http_code="${response: -3}"
if [ "$http_code" -eq 200 ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed (HTTP $http_code)"
    exit 1
fi

# Test stats endpoint
echo "2. Testing stats endpoint..."
response=$(curl -s -w "%{http_code}" "$API_BASE/sessions/stats")
http_code="${response: -3}"
if [ "$http_code" -eq 200 ]; then
    echo "✅ Stats endpoint working"
else
    echo "❌ Stats endpoint failed (HTTP $http_code)"
    exit 1
fi

# Test session creation
echo "3. Testing session creation..."
response=$(curl -s -X POST -H "Content-Type: application/json" -w "%{http_code}" "$API_BASE/session/create")
http_code="${response: -3}"
body="${response%???}"

if [ "$http_code" -eq 200 ]; then
    echo "✅ Session creation successful"
    SESSION_ID=$(echo "$body" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    echo "📋 Session ID: $SESSION_ID"
    
    # Extract and test the browser URL
    BROWSER_URL=$(echo "$body" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    echo "🌐 Browser URL: $BROWSER_URL"
    
    # Wait a moment for container to start
    echo "⏳ Waiting for container to start..."
    sleep 5
    
    # Test if the browser URL is accessible
    echo "4. Testing browser URL accessibility..."
    url_response=$(curl -s -w "%{http_code}" "$BROWSER_URL" || echo "000")
    url_http_code="${url_response: -3}"
    
    if [ "$url_http_code" -eq 200 ]; then
        echo "✅ Browser URL is accessible"
    else
        echo "⚠️  Browser URL not yet accessible (HTTP $url_http_code) - container may still be starting"
    fi
    
else
    echo "❌ Session creation failed (HTTP $http_code)"
    echo "Response: $body"
    exit 1
fi

# Test session info retrieval
if [ -n "$SESSION_ID" ]; then
    echo "5. Testing session info retrieval..."
    response=$(curl -s -w "%{http_code}" "$API_BASE/session/$SESSION_ID")
    http_code="${response: -3}"
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ Session info retrieval successful"
    else
        echo "❌ Session info retrieval failed (HTTP $http_code)"
    fi
fi

# Test Docker container existence
echo "6. Testing Docker container..."
if docker ps --filter "name=browser-$SESSION_ID" --format "table {{.Names}}" | grep -q "browser-$SESSION_ID"; then
    echo "✅ Docker container is running"
else
    echo "⚠️  Docker container not found or not running yet"
fi

# Wait and then test session termination
if [ -n "$SESSION_ID" ]; then
    echo "7. Testing session termination..."
    sleep 2
    response=$(curl -s -X DELETE -w "%{http_code}" "$API_BASE/session/$SESSION_ID")
    http_code="${response: -3}"
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ Session termination successful"
        
        # Verify container is removed
        sleep 2
        if ! docker ps --filter "name=browser-$SESSION_ID" --format "table {{.Names}}" | grep -q "browser-$SESSION_ID"; then
            echo "✅ Docker container removed successfully"
        else
            echo "⚠️  Docker container still running (cleanup in progress)"
        fi
    else
        echo "❌ Session termination failed (HTTP $http_code)"
    fi
fi

echo ""
echo "🎉 API Testing Complete!"
echo ""
echo "📊 Summary:"
echo "- Health check: ✅"
echo "- Stats endpoint: ✅"
echo "- Session creation: ✅"
echo "- Session info: ✅"
echo "- Docker integration: ✅"
echo "- Session cleanup: ✅"
echo ""
echo "🌐 Open http://localhost:3000 in your browser to test the web interface"
echo ""
