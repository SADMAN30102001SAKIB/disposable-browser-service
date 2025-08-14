#!/bin/bash

# Disposable Browser Service Setup Script
# This script builds and sets up the entire disposable browser service

set -e

echo "🚀 Setting up Disposable Browser Service..."
echo "========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is installed and running"

# Build the browser container image
echo "🔨 Building disposable browser container..."
docker build -t disposable-browser .

if [ $? -eq 0 ]; then
    echo "✅ Browser container built successfully"
else
    echo "❌ Failed to build browser container"
    exit 1
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
if command -v npm &> /dev/null; then
    npm install
    echo "✅ Dependencies installed successfully"
else
    echo "⚠️  npm not found. Will use Docker for backend."
fi

# Create logs directory
mkdir -p logs

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "🚀 To start the service:"
echo "   Option 1 - Using Docker Compose (recommended):"
echo "   docker-compose up -d"
echo ""
echo "   Option 2 - Manual start:"
echo "   1. Start backend: node server.js"
echo "   2. Open browser: http://localhost:3000"
echo ""
echo "📊 Service will be available at: http://localhost:3000"
echo "📈 API endpoints:"
echo "   - POST /api/session/create - Create new browser session"
echo "   - GET /api/session/:id - Get session info"
echo "   - DELETE /api/session/:id - Terminate session"
echo "   - GET /api/sessions/stats - Get session statistics"
echo "   - GET /api/health - Health check"
echo ""
echo "🔧 Configuration:"
echo "   - Max sessions: 100"
echo "   - Session timeout: 30 minutes"
echo "   - Port range: 50000-60000"
echo "   - Container limits: 1 CPU, 512MB RAM"
echo ""
echo "⚠️  Make sure ports 3000 and 50000-60000 are available!"
echo ""
