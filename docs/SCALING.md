# 🚀 Scaling Guide for Disposable Browser Service

This guide shows how to scale the disposable browser service to handle multiple backend replicas safely.

## 🔄 What Changed for Scaling

### 1. **Redis Port Coordination (portAllocator.js)**

- Added `portAllocator.js` with Redis-backed port allocation
- Prevents port collisions between multiple backend instances
- Automatic cleanup of stale port allocations
- **Purpose**: Manages HOST PORT allocation to prevent conflicts

### 2. **Redis Session Management (sessionManager.js)**

- Added `sessionManager.js` with Redis-backed session storage
- All backend instances share the same session data
- Ensures consistent session visibility across load balancer
- **Purpose**: Manages SESSION DATA storage for multi-backend coordination

### 3. **Traefik Load Balancer**

- Routes incoming requests across multiple backend replicas
- Health checks and automatic discovery
- Single entry point (port 80) for all traffic

### 4. **Compose Configuration**

- `docker-compose.yml` for scaled deployment
- Redis service for shared state
- No fixed host port binding for backend service

## 🏃‍♂️ Quick Start (Scaled)

### Prerequisites

```powershell
# Ensure you have enough resources
# Each backend: ~100MB RAM + each browser session: ~512MB RAM
# For 3 backends + 30 sessions: ~16GB RAM recommended
```

### 1. Build the Browser Image (if not done already)

```powershell
docker build -t disposable-browser .\docker
```

### 2. Start Scaled Services

```powershell
# Start with 3 backend replicas
docker compose up -d --build --scale backend=3
```

### 3. Access the Service

```powershell
# API is now available on port 80 (instead of 3000)
curl http://localhost/api/health

# Traefik dashboard (see load balancing in action)
# Open: http://localhost:8080
```

### 4. Test Load Balancing

```powershell
# Create multiple sessions - they'll be distributed across replicas
curl -X POST http://localhost/api/session/create
curl -X POST http://localhost/api/session/create
curl -X POST http://localhost/api/session/create

# Check stats
curl http://localhost/api/sessions/stats
```

## 📊 Scaling Commands

### Scale Up

```powershell
# Increase to 5 replicas
docker compose up -d --scale backend=5

# Scale down to 2 replicas
docker compose up -d --scale backend=2
```

### Monitor Scaling

```powershell
# See running containers
docker ps --filter "name=disposable"

# View logs from all replicas
docker compose logs backend

# Check Traefik dashboard
# http://localhost:8080 -> HTTP -> Services -> backend
```

## 🔍 How It Works

### 🎯 **Two Redis Components Explained**

The scaling architecture uses **two separate Redis-based coordinators**:

#### **🔌 PortAllocator.js** - "The Port Traffic Controller"

```javascript
// What it manages: HOST PORT allocation
portAllocator.allocate() → Returns: 50001 (unique host port)
portAllocator.release(50001) → Frees port for reuse
```

**Problem it solves**:

```
❌ Without PortAllocator:
Backend-1: "I'll use port 50001"
Backend-2: "I'll use port 50001" ← CONFLICT!

✅ With PortAllocator:
Backend-1: allocate() → 50001
Backend-2: allocate() → 50002  ← Safe!
```

#### **📊 SessionManager.js** - "The Session Data Coordinator"

```javascript
// What it manages: SESSION DATA storage
sessionManager.setSession(id, data) → Stores in Redis
sessionManager.getAllSessions() → Returns ALL sessions from ALL backends
```

**Problem it solves**:

```
❌ Without SessionManager:
Frontend refresh → Backend-1 → Shows 2 sessions
Frontend refresh → Backend-2 → Shows 3 sessions ← Inconsistent!

✅ With SessionManager:
Frontend refresh → Backend-1 → Shows 5 sessions (from Redis)
Frontend refresh → Backend-2 → Shows 5 sessions ← Consistent!
```

### Port Allocation Flow

```
1. Client requests session creation
2. Traefik forwards to one backend replica
3. Backend calls Redis: "Give me an available port"
4. Redis atomically reserves port (e.g., 50001)
5. Backend creates browser container on that port
6. Container is accessible at http://localhost:50001/vnc.html
7. When session ends, port is released back to Redis
```

### Load Balancing Flow

```
Client Request -> Traefik (port 80) -> Backend Replica (round-robin)
```

### Redis Data Structure

```redis
# 🔌 PortAllocator: Port allocations stored as sorted set with timestamps
ZRANGE disposable-browser:ports:allocated 0 -1 WITHSCORES
# Example:
# 1) "50001"    2) "1692123456789"
# 3) "50002"    4) "1692123457891"

# 📊 SessionManager: Session data stored with TTL
KEYS session:*
# Example:
# 1) "session:abc-123-def"
# 2) "session:xyz-456-ghi"

GET session:abc-123-def
# {"sessionId":"abc-123-def","port":50001,"url":"http://localhost:50001/vnc.html",...}
```

## 🔧 Configuration

### Environment Variables (scaled mode)

```bash
NODE_ENV=production
PORT=3000                    # Internal port (not exposed to host)
REDIS_URL=redis://redis:6379 # Redis connection
MAX_SESSIONS=200             # Per replica limit
PORT_RANGE_START=50000
PORT_RANGE_END=60000
SESSION_TIMEOUT=1800000      # 30 minutes
```

### Resource Limits (optional)

Add to `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.0"
        reservations:
          memory: 512M
          cpus: "0.5"
```

## 📈 Performance Tips

### Optimal Scaling

- **2-3 replicas**: Good for development/testing
- **3-5 replicas**: Suitable for small-medium production
- **5+ replicas**: Monitor resource usage carefully

### Resource Planning

```
Each Backend Replica: ~100MB RAM, 0.1 CPU
Each Browser Session: ~512MB RAM, 0.5 CPU
Redis: ~50MB RAM

Example for 50 concurrent sessions across 3 replicas:
- 3 × 100MB (backends) = 300MB
- 50 × 512MB (sessions) = 25GB
- Total: ~26GB RAM needed
```

### Monitoring

```powershell
# Monitor resource usage
docker stats

# Monitor session distribution
watch "curl -s http://localhost/api/sessions/stats | jq"
```

---

## Summary

✅ **Multiple backend replicas** - Scale with `--scale backend=N`  
✅ **Load balancing** - Traefik handles traffic distribution  
✅ **Safe port allocation** - PortAllocator prevents collisions  
✅ **Shared session data** - SessionManager ensures consistency  
✅ **Health monitoring** - Automatic replica discovery  
✅ **Zero downtime scaling** - Add/remove replicas on the fly

**Key Files**:

- `portAllocator.js` - Manages host port allocation across replicas
- `sessionManager.js` - Shares session data across all backend instances
- `docker-compose.yml` - Orchestrates scaled deployment with Redis coordination
