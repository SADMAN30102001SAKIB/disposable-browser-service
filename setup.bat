@echo off
REM Disposable Browser Service Setup Script for Windows
REM This script builds and sets up the entire disposable browser service

echo 🚀 Setting up Disposable Browser Service...
echo =========================================

REM Check if Docker is installed
docker --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM Check if Docker daemon is running
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Docker daemon is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

echo ✅ Docker is installed and running

REM Build the browser container image
echo 🔨 Building disposable browser container...
docker build -t disposable-browser .

if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to build browser container
    pause
    exit /b 1
)

echo ✅ Browser container built successfully

REM Install Node.js dependencies
echo 📦 Installing Node.js dependencies...
npm --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    npm install
    echo ✅ Dependencies installed successfully
) else (
    echo ⚠️  npm not found. Will use Docker for backend.
)

REM Create logs directory
if not exist logs mkdir logs

echo.
echo 🎉 Setup completed successfully!
echo.
echo 🚀 To start the service:
echo    Option 1 - Using Docker Compose (recommended):
echo    docker-compose up -d
echo.
echo    Option 2 - Manual start:
echo    1. Start backend: node server.js
echo    2. Open browser: http://localhost:3000
echo.
echo 📊 Service will be available at: http://localhost:3000
echo 📈 API endpoints:
echo    - POST /api/session/create - Create new browser session
echo    - GET /api/session/:id - Get session info
echo    - DELETE /api/session/:id - Terminate session
echo    - GET /api/sessions/stats - Get session statistics
echo    - GET /api/health - Health check
echo.
echo 🔧 Configuration:
echo    - Max sessions: 100
echo    - Session timeout: 30 minutes
echo    - Port range: 50000-60000
echo    - Container limits: 1 CPU, 512MB RAM
echo.
echo ⚠️  Make sure ports 3000 and 50000-60000 are available!
echo.
pause
