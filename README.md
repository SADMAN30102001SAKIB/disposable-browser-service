# 🎉 DISPOSABLE BROWSER SERVICE

A **production-ready disposable browser service** that creates isolated, ephemeral browser sessions using Docker containers. Each user gets their own secure browser environment that's automatically destroyed when they're done.

### ⚠️ **BREAKING CHANGE NOTICE**

**Version 2.0**: This version introduces Redis-based session management for proper multi-backend scaling. If upgrading from a previous version:

1. **New dependency**: Redis is now **required** (included in docker-compose.yml)
2. **Enhanced scaling**: All backend replicas now share session data consistently
3. **Better load balancing**: Frontend shows consistent session counts regardless of backend routing

### 🔧 Technical Stack

- **Backend**: Node.js + Express.js + Dockerode
- **Security**: Helmet.js, CORS, non-root containers
- **Load Balancer & Reverse Proxy**: Traefik (ports 80, 8080)
- **Redis Coordination**:
  - **Port Allocation** (`portAllocator.js`): Prevents host port conflicts across backend replicas
  - **Session Management** (`sessionManager.js`): Shares session data across all backend instances
- **Docker Container**: Backends (internal port 3000) & Browsers (Ubuntu + Chrome + Xvfb + VNC)
- **Process Management**: Supervisor
- **Frontend (not main focus)**: HTML/CSS/JavaScript (no frameworks yet)

## 📈 Performance & Scaling

### Browser Resource Usage (per session)

- **Per session**: ~512MB RAM, 0.5-1 CPU core
- **50 sessions**: ~25GB RAM, 25-50 CPU cores
- **Startup time**: ~2-5 seconds
- **Network**: ~10Mbps per active session
- **Storage**: Minimal (containers are ephemeral)

### Scaling Recommendations

- **Small deployment**: 1 server, 10-20 sessions
- **Medium deployment**: 3-5 servers, 100-500 sessions
- **Large deployment**: Kubernetes cluster, 1000+ sessions
- **Horizontal scaling**: Run multiple backend instances
- **Load balancing**: Use Nginx
- **Container pre-warming**: Keep idle containers ready
- **Resource monitoring**: Use Prometheus + Grafana
- **Auto-scaling**: Scale based on session demand

### 🚀 UPDATE (I've Added Backend Scaling)

**[📖 See complete Scaling Guide →](./docs/SCALING.md)** for Redis coordination, load balancing, and multi-replica deployment instructions.

### 🏗️ Architecture

#### Single Instance Flow

```
User → http://localhost:80 → Traefik ───→ Backend ──────→ Redis ───→ Create Browser Containers
                        (Load Balancer)   (Unique Port Check + Session Storage)
```

#### Scaled Architecture (Multiple Replicas)

```
                               ┌─── Backend Replica 1 ───┐
User Request at port 80 → Traefik ─ Backend Replica 2 ───┼─→ Redis → Browser Containers Creation
                               └─── Backend Replica N ───┘
                                            │
                                   🔥 All backends share
                                   Redis session storage
                                   (sessionManager.js)
```

#### Detailed Session Creation Flow

```
1. User clicks "Launch Browser" on web interface
         ↓
2. Request hits Traefik load balancer (port 80)
         ↓
3. Traefik routes to available backend replica (round-robin)
         ↓
4. Backend generates unique session ID
         ↓
5. Backend queries Redis for available host port (atomic allocation in portAllocator.js)
         ↓
5.1. 🆕 Backend stores session data in Redis (sessionManager.js)
         ↓
6. Docker container created by the Backend with:
   - Chrome Browser (gets loaded in RAM with Incognito mode)
   - Xvfb (creates fake display/framebuffer of Chrome in the RAM with display number :99)
   - Fluxbox (a window manager)
   - VNC Server (runs on port 5900 & takes pixels from that fake monitor with display number :99)
   - noVNC WebSocket Proxy (runs on port 8080, gets frames on VNC protocol from VNC server & send those frames to frontend[vnc.html])
         ↓
7. Container starts and binds 8080 to allocated host port
         ↓
8. User receives: http://localhost:PORT/vnc.html
         ↓
9. User browses in completely isolated environment
         ↓
10. Session expires (30min) OR user terminates
         ↓
11. Container destroyed + Port released back to Redis + **Session removed from Redis**
```

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Node.js 18+** (optional, can use Docker)
- **8GB+ RAM** recommended for multiple sessions
- **Available ports**: 80, 8080, 50000-60000

### Installation

1. **Clone the repository**:

   ```bash
   git clone <repo-url>
   cd disposable-browser-service
   ```

2. **Run setup script**:

   **Windows**:

   ```cmd
   ./scripts/setup.bat
   ```

   **Linux/Mac**:

   ```bash
   chmod +x ./scripts/setup.sh
   ./scripts/setup.sh
   ```

3. **Start/Stop the service**:

   ```bash
   # Option 1: Docker Compose (recommended)
   docker compose build # To Build
   docker compose up -d # To Start
   docker compose down  # To Stop

   # Option 2: Manual
   node server.js
   ```

4. **Open in browser**:

   ```
   http://localhost
   ```

   **Note**: API is now available on port 80 (via Traefik load balancer) instead of port 3000.

5. **Check Server(s) Logs**:

   ```bash
   docker compose logs -f backend
   ```

## 📁 Project Structure

```
disposable-browser-service/
├── 📄 docker-compose.yml        # Root orchestration with include directive
├── 📄 package.json              # Node.js dependencies
├── 📄 README.md                 # Comprehensive documentation
├── 📄 .gitignore                # Git ignore rules
├── 📁 src/                      # Source code directory
│   ├── 📄 server.js             # Main API server (Express.js + Redis coordinators)
│   └── 📁 lib/                  # Shared libraries
│       ├── 🆕 portAllocator.js  # Redis-based port coordination for scaling
│       └── 🆕 sessionManager.js # Redis-based session storage for multi-backend coordination
├── 📁 docker/                   # Docker configuration
│   ├── 📄 Dockerfile            # Browser container (Ubuntu + Chrome + Xvbf + Fluxbox + VNC)
│   ├── 📄 Dockerfile.backend    # Backend service container
│   ├── 📄 docker-compose.yml    # Multi-container orchestration (supports scaling)
│   ├── 📄 start.sh              # Container startup script
│   └── 📄 supervisord.conf      # Process management
├── 📁 docs/                     # Documentation
│   └── 📄 SCALING.md            # Complete scaling guide & load balancing
├── 📁 scripts/                  # Automation scripts
│   ├── 📄 setup.sh/.bat         # Automated setup scripts
│   └── 📄 test.sh/.bat          # Testing scripts
└── 📁 public/                   # Static web assets
    ├── 📄 index.html            # Beautiful web interface
    ├── 📄 script.js             # Frontend JavaScript
    └── 📄 style.css             # Frontend styles
```

## 🧪 Testing

The project includes comprehensive test scripts to verify API functionality and service health.

### Running Tests

**Windows**:

```cmd
./scripts/test.bat
```

**Linux/Mac**:

```bash
chmod +x ./scripts/test.sh
./scripts/test.sh
```

### What the Tests Cover

- ✅ **Health Check**: Verifies service is running and responsive
- ✅ **API Endpoints**: Tests all REST API endpoints
- ✅ **Session Creation**: Creates and validates browser sessions
- ✅ **Session Management**: Tests session info retrieval and cleanup
- ✅ **Statistics**: Verifies session statistics endpoint
- ✅ **Error Handling**: Tests error responses and edge cases

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

## 🛡️ Security Features

### Container Security

- **Non-root user**: Browser runs as `browseruser`
- **Read-only filesystem**: Root filesystem is read-only where possible
- **No new privileges**: Prevents privilege escalation
- **Resource limits**: CPU and memory constraints
- **Network isolation**: Containers use bridge network

### Application Security

- **Auto-removal**: Orphan Containers are automatically removed
- **Session timeout**: Forced cleanup after 30 minutes
- **CORS protection**: Cross-origin request security
- **Helmet.js**: Security headers middleware
- **Incognito mode**: No browsing data persistence

## 📊 Monitoring & Logging

### Health Monitoring

```bash
# Check service health (now shows consistent results across backends)
curl http://localhost/api/health

# Check active sessions (consistent count across all backend replicas)
curl http://localhost/api/sessions

# Check session statistics
curl http://localhost/api/sessions/stats

# Monitor Docker containers
docker ps | grep browser-

# Verify Redis session storage
docker exec disposable-browser-service-redis-1 redis-cli KEYS "session:*"
```

### Server Log Management

#### Real-time Server Logs

```bash
# Follow backend service logs (recommended)
docker compose logs -f backend

# Follow specific backend container logs
docker logs -f disposable-browser-service-backend-1

# Follow all services logs (backend + redis + traefik)
docker compose logs -f

# View last 100 lines of backend logs
docker logs --tail 100 disposable-browser-service-backend-1
```

#### Individual Container Logs

```bash
# View browser container logs
docker logs browser-<session-id>

# System resource usage
docker stats
```

## 🔄 Updates & Maintenance

### Updating the Service

```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker compose down
docker compose build --no-cache
docker compose up -d
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
