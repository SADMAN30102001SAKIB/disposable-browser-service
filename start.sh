#!/bin/bash

# Set display
export DISPLAY=:99

# Start virtual display
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
sleep 2

# Start fluxbox window manager
fluxbox &
sleep 2

# Start VNC server
x11vnc -display :99 -nopw -listen localhost -xkb -forever -shared &
sleep 2

# Start noVNC
/opt/noVNC/utils/novnc_proxy --vnc localhost:5900 --listen 8080 &
sleep 2

# Launch Google Chrome as browseruser
su - browseruser -c "DISPLAY=:99 google-chrome --no-sandbox --disable-gpu --disable-dev-shm-usage --start-maximized --no-first-run --disable-default-apps --disable-extensions --incognito --disable-web-security --user-data-dir=/tmp" &

# Keep script running
wait
