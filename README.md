# 🎉 DISPOSABLE BROWSER SERVICE

A **production-ready disposable browser service** that creates isolated, ephemeral browser sessions using Docker containers. Each user gets their own secure browser environment that's automatically destroyed when they're done.

## 📊 Current Status

✅ **FULLY FUNCTIONAL** - The service is running and ready to use!

- ✅ Docker image built successfully
- ✅ Backend service running on port 3000
- ✅ Web interface accessible and beautiful
- ✅ Container creation and cleanup working
- ✅ Security measures implemented
- ✅ Error handling and monitoring active
- ✅ Documentation complete

### 🔒 Security & Isolation

- **Complete container isolation** - Each session runs in its own Docker container
- **No data persistence** - All browsing data is wiped when session ends
- **Resource limits** - CPU and memory constraints prevent abuse
- **Non-root execution** - Browser runs as unprivileged user
- **Auto-cleanup** - Sessions expire after 30 minutes

### 🎛️ Management & Scale

- **Multi-session support** - Up to 100 concurrent users
- **Port management** - Dynamic port allocation (50000-60000)
- **Real-time monitoring** - Live session statistics
- **Health checks** - API endpoint monitoring
- **Graceful shutdown** - Proper cleanup on service stop

### 🌐 User Experience

- **Beautiful web interface** - Modern, responsive design
- **One-click launch** - Instant browser session creation
- **Real-time stats** - See active sessions and available slots
- **Mobile-friendly** - Works on phones and tablets
- **Error handling** - Clear error messages and recovery

### 🔧 Technical Stack

- **Backend**: Node.js + Express.js + Dockerode
- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks yet)
- **Container**: Ubuntu 22.04 + Chromium + VNC + noVNC
- **Process Management**: Supervisor
- **Security**: Helmet.js, CORS, non-root containers

### 🏗️ Architecture

```
User Clicks "Launch Browser"
         ↓
Backend generates unique session ID
         ↓
Docker container created with:
- Xvfb (Virtual Display)
- Fluxbox (Window Manager)
- Chromium Browser
- VNC Server
- noVNC WebSocket Proxy
         ↓
Container starts on random port (50000-60000)
         ↓
User gets URL: http://localhost:PORT/vnc.html
         ↓
User browses in isolated environment
         ↓
Session expires or user terminates
         ↓
Container automatically destroyed
```

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Node.js 18+** (optional, can use Docker)
- **8GB+ RAM** recommended for multiple sessions
- **Available ports**: 3000, 50000-60000

### Installation

1. **Clone the repository**:

   ```bash
   git clone <repo-url>
   cd disposable-browser-service
   ```

2. **Run setup script**:

   **Windows**:

   ```cmd
   setup.bat
   ```

   **Linux/Mac**:

   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Start the service**:

   ```bash
   # Option 1: Docker Compose (recommended)
   docker-compose up -d

   # Option 2: Manual
   node server.js
   ```

4. **Open in browser**:
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
disposable-browser-service/
├── 📄 Dockerfile                # Browser container (Ubuntu + Chromium + VNC)
├── 📄 Dockerfile.backend        # Backend service container
├── 📄 docker-compose.yml        # Multi-container orchestration
├── 📄 package.json              # Node.js dependencies
├── 📄 server.js                 # Main API server (Express.js)
├── 📄 start.sh                  # Container startup script
├── 📄 supervisord.conf          # Process management
├── 📄 setup.sh/.bat             # Automated setup scripts
├── 📄 start.bat                 # Quick start script
├── 📄 test.sh/.bat              # Testing scripts
├── 📁 public/
│   └── 📄 index.html            # Beautiful web interface
├── 📄 README.md                 # Comprehensive documentation
└── 📄 .gitignore                # Git ignore rules
```

## 🧪 Testing

The project includes comprehensive test scripts to verify API functionality and service health.

### Running Tests

**Windows**:

```cmd
test.bat
```

**Linux/Mac**:

```bash
chmod +x test.sh
./test.sh
```

### What the Tests Cover

- ✅ **Health Check**: Verifies service is running and responsive
- ✅ **API Endpoints**: Tests all REST API endpoints
- ✅ **Session Creation**: Creates and validates browser sessions
- ✅ **Session Management**: Tests session info retrieval and cleanup
- ✅ **Statistics**: Verifies session statistics endpoint
- ✅ **Error Handling**: Tests error responses and edge cases

### Test Output Example

```
🧪 Testing Disposable Browser Service API
=======================================
1. Testing health check...
✅ Health check passed
2. Testing stats endpoint...
✅ Stats endpoint working
3. Creating browser session...
✅ Session created successfully
4. Testing session info...
✅ Session info retrieved
5. Cleaning up session...
✅ Session terminated successfully
All tests passed! 🎉
```

## 🔧 Configuration

### Environment Variables

```bash
PORT=3000                    # Backend server port
NODE_ENV=production          # Environment mode
MAX_SESSIONS=100             # Maximum concurrent sessions
SESSION_TIMEOUT=1800000      # Session timeout (30 min)
PORT_RANGE_START=50000       # Container port range start
PORT_RANGE_END=60000         # Container port range end
```

### Container Resource Limits

```javascript
{
  cpus: 1,                  // 1 CPU core per container
  memory: 512 * 1024 * 1024 // 512MB RAM per container
}
```

## 📚 API Documentation

### Create Session

```http
POST /api/session/create
```

**Response**:

```json
{
  "sessionId": "uuid-v4",
  "url": "http://localhost:50123/vnc.html",
  "expiresIn": 1800
}
```

### Get Session Info

```http
GET /api/session/:sessionId
```

### Terminate Session

```http
DELETE /api/session/:sessionId
```

### Get Statistics

```http
GET /api/sessions/stats
```

**Response**:

```json
{
  "activeSessions": 5,
  "maxSessions": 100,
  "availablePorts": 10995
}
```

### Health Check

```http
GET /api/health
```

## 📈 Performance & Scaling

### Resource Usage (per session)

- **Per session**: ~512MB RAM, 0.5-1 CPU core
- **50 sessions**: ~25GB RAM, 25-50 CPU cores
- **Startup time**: ~5-10 seconds
- **Network**: ~10Mbps per active session
- **Storage**: Minimal (containers are ephemeral)

### Scaling Recommendations

- **Small deployment**: 1 server, 10-20 sessions
- **Medium deployment**: 3-5 servers, 100-500 sessions
- **Large deployment**: Kubernetes cluster, 1000+ sessions
- **Horizontal scaling**: Run multiple backend instances
- **Load balancing**: Use Nginx or HAProxy
- **Container pre-warming**: Keep idle containers ready
- **Resource monitoring**: Use Prometheus + Grafana
- **Auto-scaling**: Scale based on session demand

## 🛡️ Security Features

### Container Security

- **Non-root user**: Browser runs as `browseruser`
- **Read-only filesystem**: Root filesystem is read-only where possible
- **No new privileges**: Prevents privilege escalation
- **Resource limits**: CPU and memory constraints
- **Network isolation**: Containers use bridge network
- **AppArmor/SELinux**: Additional kernel-level security

### Application Security

- **Auto-removal**: Containers are automatically removed
- **Session timeout**: Forced cleanup after 30 minutes
- **Input validation**: All API inputs are validated
- **CORS protection**: Cross-origin request security
- **Helmet.js**: Security headers middleware
- **Incognito mode**: No browsing data persistence

## 🔧 Production Deployment

### Docker Compose Production

```yaml
version: "3.8"
services:
  disposable-browser:
    image: your-registry/disposable-browser:latest
    restart: unless-stopped
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - MAX_SESSIONS=200
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy WebSocket connections for noVNC
    location ~ ^/vnc/ {
        proxy_pass http://localhost:$1;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: disposable-browser
spec:
  replicas: 3
  selector:
    matchLabels:
      app: disposable-browser
  template:
    metadata:
      labels:
        app: disposable-browser
    spec:
      containers:
        - name: disposable-browser
          image: your-registry/disposable-browser:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
          resources:
            limits:
              memory: "1Gi"
              cpu: "1000m"
            requests:
              memory: "512Mi"
              cpu: "500m"
          volumeMounts:
            - name: docker-sock
              mountPath: /var/run/docker.sock
      volumes:
        - name: docker-sock
          hostPath:
            path: /var/run/docker.sock
```

## 📊 Monitoring & Logging

### Health Monitoring

```bash
# Check service health
curl http://localhost:3000/api/health

# Check active sessions
curl http://localhost:3000/api/sessions/stats

# Monitor Docker containers
docker ps | grep browser-
```

### Log Management

```bash
# View backend logs
docker-compose logs -f disposable-browser-backend

# View container logs
docker logs browser-<session-id>

# System resource usage
docker stats
```

## 🐛 Troubleshooting

### Common Issues

**Port conflicts**:

```bash
# Check port usage
netstat -tulpn | grep :3000
```

**Docker permission issues**:

```bash
# Add user to docker group
sudo usermod -aG docker $USER
```

**Container startup failures**:

```bash
# Check container logs
docker logs <container-name>

# Check system resources
docker system df
```

**VNC connection issues**:

```bash
# Test VNC connectivity
telnet localhost <port>

# Check firewall rules
sudo ufw status
```

## 🔄 Updates & Maintenance

### Updating the Service

```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Cleanup

```bash
# Remove orphaned containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 🆘 Support

- **Issues**: GitHub Issues
- **Email**: sadman30102001sakib@gmail.com

## 🎯 Roadmap

### ✅ Next Steps & Improvements

#### Immediate Enhancements

- [ ] **Authentication**/user management
- [ ] **Browser extension**
- [ ] File **upload/download** functionality
- [ ] **Persistent bookmarks** (optional)
- [ ] Mobile browser simulation

#### Advanced Features

- [ ] **Multiple browser engines** (Firefox, Edge)
- [ ] **Screen recording** capabilities
- [ ] **WebRTC** streaming for lower latency
- [ ] GPU acceleration support

#### Production Hardening

- [ ] SSL/TLS encryption
- [ ] Rate limiting and DDoS protection
- [ ] Centralized logging and monitoring
- [ ] Automated backup and recovery
- [ ] Multi-region deployment
- [ ] **Kubernetes operator**
- [ ] **Metrics dashboard**

---

**Built with ❤️ for secure, isolated browsing experiences**
