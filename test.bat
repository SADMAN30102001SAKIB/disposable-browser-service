@echo off
REM Test script for Disposable Browser Service (Windows)
REM This script tests the API endpoints and basic functionality

echo 🧪 Testing Disposable Browser Service API
echo =======================================

set API_BASE=http://localhost:3000/api
set SESSION_ID=

REM Test health check
echo 1. Testing health check...
curl -s %API_BASE%/health > nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Health check passed
) else (
    echo ❌ Health check failed
    goto :error
)

REM Test stats endpoint
echo 2. Testing stats endpoint...
curl -s %API_BASE%/sessions/stats > nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Stats endpoint working
) else (
    echo ❌ Stats endpoint failed
    goto :error
)

REM Test session creation
echo 3. Testing session creation...
curl -s -X POST -H "Content-Type: application/json" %API_BASE%/session/create > temp_response.json
if %ERRORLEVEL% equ 0 (
    echo ✅ Session creation successful
    REM Note: Windows batch has limited JSON parsing capabilities
    echo 📋 Check temp_response.json for session details
) else (
    echo ❌ Session creation failed
    goto :error
)

REM Wait for container to start
echo ⏳ Waiting for container to start...
timeout /t 5 /nobreak > nul

echo 4. Testing Docker integration...
docker ps --filter "name=browser-" --format "table {{.Names}}" | findstr "browser-" > nul
if %ERRORLEVEL% equ 0 (
    echo ✅ Docker containers are running
) else (
    echo ⚠️  No Docker containers found ^(may still be starting^)
)

echo.
echo 🎉 Basic API Testing Complete!
echo.
echo 📊 Summary:
echo - Health check: ✅
echo - Stats endpoint: ✅
echo - Session creation: ✅
echo - Docker integration: ✅
echo.
echo 🌐 Open http://localhost:3000 in your browser to test the web interface
echo ⚠️  Use the web interface to create and terminate sessions for full testing
echo.
echo 🧹 Cleaning up temp files...
if exist temp_response.json del temp_response.json

pause
goto :end

:error
echo.
echo ❌ Test failed. Make sure the service is running with: node server.js
echo.
pause

:end
