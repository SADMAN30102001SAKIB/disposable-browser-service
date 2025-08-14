@echo off
REM Quick start script for Disposable Browser Service

echo 🚀 Starting Disposable Browser Service...
echo =====================================

REM Check if setup has been run
if not exist node_modules (
    echo ⚠️  Dependencies not found. Running setup first...
    call setup.bat
    if %ERRORLEVEL% neq 0 (
        echo ❌ Setup failed
        pause
        exit /b 1
    )
)

REM Start the service
echo 🎯 Starting backend server...
echo 📊 Service will be available at: http://localhost:3000
echo 🔧 Press Ctrl+C to stop the service
echo.

node server.js
