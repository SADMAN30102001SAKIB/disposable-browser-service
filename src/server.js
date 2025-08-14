const express = require("express");
const Docker = require("dockerode");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const helmet = require("helmet");
const {
  RedisPortAllocator,
  LocalPortAllocator,
} = require("./lib/portAllocator");
const SessionManager = require("./lib/sessionManager");

const app = express();
const docker = new Docker();
const PORT = parseInt(process.env.PORT) || 3000;
const sessionManager = new SessionManager();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"], // Explicitly block inline event handlers for security
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Initialize session manager
async function initializeServices() {
  await sessionManager.connect();
}

// Store active sessions - now using Redis-based session manager
// const activeSessions = new Map(); // Replaced with sessionManager

// Configuration
const CONFIG = {
  IMAGE_NAME: "disposable-browser",
  PORT_RANGE_START: parseInt(process.env.PORT_RANGE_START) || 50000,
  PORT_RANGE_END: parseInt(process.env.PORT_RANGE_END) || 60000,
  MAX_SESSIONS: parseInt(process.env.MAX_SESSIONS) || 100,
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
  CONTAINER_LIMITS: {
    cpus: 1,
    memory: 512 * 1024 * 1024, // 512MB
  },
};

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

// Simple logging utility
const log = {
  info: message => console.log(`[INFO] ${message}`),
  debug: message => !IS_PRODUCTION && console.log(`[DEBUG] ${message}`),
  error: message => console.error(`[ERROR] ${message}`),
};

// Initialize port allocator (Redis if available, fallback to local)
const REDIS_URL = process.env.REDIS_URL;
let portAllocator;

if (REDIS_URL) {
  portAllocator = new RedisPortAllocator({
    start: CONFIG.PORT_RANGE_START,
    end: CONFIG.PORT_RANGE_END,
    redisUrl: REDIS_URL,
    ttlMs: CONFIG.SESSION_TIMEOUT,
  });
  log.info(`Using Redis port allocator: ${REDIS_URL}`);
} else {
  portAllocator = new LocalPortAllocator({
    start: CONFIG.PORT_RANGE_START,
    end: CONFIG.PORT_RANGE_END,
  });
  log.info("Using local port allocator (single instance only)");
}

// Initialize allocator
portAllocator.init().catch(err => {
  log.error(`Failed to initialize port allocator: ${err.message}`);
  process.exit(1);
});

// Get available port (removed old function)
async function getAvailablePort() {
  return await portAllocator.allocate();
}

// Create browser session
app.post("/api/session/create", async (req, res) => {
  try {
    // Check session limit
    const currentSessionCount = await sessionManager.getSessionCount();
    if (currentSessionCount >= CONFIG.MAX_SESSIONS) {
      return res.status(429).json({
        error: "Maximum number of sessions reached. Please try again later.",
      });
    }

    const sessionId = uuidv4();
    const port = await getAvailablePort();
    const containerName = `browser-${sessionId}`;

    log.info(`Creating session ${sessionId} on port ${port}`);

    // Create container
    const container = await docker.createContainer({
      Image: CONFIG.IMAGE_NAME,
      name: containerName,
      ExposedPorts: {
        "8080/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "8080/tcp": [{ HostPort: port.toString() }],
        },
        AutoRemove: true,
        CpuQuota: CONFIG.CONTAINER_LIMITS.cpus * 100000,
        Memory: CONFIG.CONTAINER_LIMITS.memory,
        SecurityOpt: ["no-new-privileges:true"],
        ReadonlyRootfs: false,
        NetworkMode: "bridge",
      },
      Env: ["DISPLAY=:99"],
    });

    // Start container
    await container.start();

    // Store session info
    const url = `http://localhost:${port}/vnc.html`;
    const expiresIn = CONFIG.SESSION_TIMEOUT / 1000;

    const session = {
      sessionId: sessionId,
      id: sessionId,
      containerId: container.id,
      containerName,
      port,
      url: url,
      expiresIn: expiresIn,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };

    await sessionManager.setSession(sessionId, session);

    // Set cleanup timeout
    setTimeout(() => {
      cleanupSession(sessionId);
    }, CONFIG.SESSION_TIMEOUT);

    res.json({
      sessionId,
      url: url,
      expiresIn: expiresIn,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create browser session" });
  }
});

// Get session info
app.get("/api/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = await sessionManager.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Update last accessed time
  session.lastAccessed = new Date().toISOString();
  await sessionManager.setSession(sessionId, session);

  res.json({
    sessionId: session.sessionId,
    url: session.url,
    createdAt: session.createdAt,
    lastAccessed: session.lastAccessed,
  });
});

// Delete session
app.delete("/api/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    await cleanupSession(sessionId);
    res.json({ message: "Session terminated successfully" });
  } catch (error) {
    console.error("Error terminating session:", error);
    res.status(500).json({ error: "Failed to terminate session" });
  }
});

// Get active sessions count
app.get("/api/sessions/stats", async (req, res) => {
  const allocatedPorts = await portAllocator.getAllocatedCount();
  const sessionCount = await sessionManager.getSessionCount();
  res.json({
    activeSessions: sessionCount,
    maxSessions: CONFIG.MAX_SESSIONS,
    allocatedPorts: allocatedPorts,
    availablePorts:
      CONFIG.PORT_RANGE_END - CONFIG.PORT_RANGE_START + 1 - allocatedPorts,
  });
});

// Get all active sessions
app.get("/api/sessions", async (req, res) => {
  const allSessions = await sessionManager.getAllSessions();
  const sessions = allSessions.map(session => ({
    sessionId: session.sessionId,
    url: session.url,
    createdAt: session.createdAt,
    expiresIn: session.expiresIn,
  }));
  res.json({ sessions });
});

// Health check
app.get("/api/health", async (req, res) => {
  const sessionCount = await sessionManager.getSessionCount();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeSessions: sessionCount,
    backendInstance: process.env.HOSTNAME || "unknown",
    processId: process.pid,
  });
});

// Cleanup function
async function cleanupSession(sessionId) {
  const session = await sessionManager.getSession(sessionId);
  if (!session) return;

  try {
    log.info(`Cleaning up session ${sessionId}`);

    // Get container and stop it
    const container = docker.getContainer(session.containerId);
    await container.stop();
    log.debug(`Container ${session.containerName} stopped`);
  } catch (error) {
    console.error(`Error stopping container for session ${sessionId}:`, error);
  } finally {
    // Release port and remove from active sessions
    if (session.port) {
      await portAllocator.release(session.port);
    }
    await sessionManager.deleteSession(sessionId);
  }
}

// Cleanup orphaned containers on startup
async function cleanupOrphanedContainers() {
  try {
    const containers = await docker.listContainers({ all: true });
    const browserContainers = containers.filter(container =>
      container.Names.some(name => name.includes("browser-")),
    );

    for (const containerInfo of browserContainers) {
      try {
        const container = docker.getContainer(containerInfo.Id);
        if (containerInfo.State !== "running") {
          await container.remove();
          console.log(`Removed orphaned container: ${containerInfo.Names[0]}`);
        }
      } catch (error) {
        console.error(
          `Error removing orphaned container ${containerInfo.Id}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error during orphaned container cleanup:", error);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");

  // Cleanup all active sessions
  const allSessions = await sessionManager.getAllSessions();
  const cleanupPromises = allSessions.map(session =>
    cleanupSession(session.sessionId),
  );

  await Promise.all(cleanupPromises);
  await portAllocator.close();
  await sessionManager.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");

  // Cleanup all active sessions
  const allSessions = await sessionManager.getAllSessions();
  const cleanupPromises = allSessions.map(session =>
    cleanupSession(session.sessionId),
  );

  await Promise.all(cleanupPromises);
  await portAllocator.close();
  await sessionManager.disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  // Initialize services
  await initializeServices();

  log.info(`Disposable Browser Service running on port ${PORT} (${NODE_ENV})`);
  log.info(
    `Configuration: MAX_SESSIONS=${CONFIG.MAX_SESSIONS}, PORT_RANGE=${CONFIG.PORT_RANGE_START}-${CONFIG.PORT_RANGE_END}, TIMEOUT=${CONFIG.SESSION_TIMEOUT}ms`,
  );
  log.debug(`API endpoints:`);
  log.debug(`  POST /api/session/create - Create new browser session`);
  log.debug(`  GET /api/session/:id - Get session info`);
  log.debug(`  DELETE /api/session/:id - Terminate session`);
  log.debug(`  GET /api/sessions/stats - Get session statistics`);
  log.debug(`  GET /api/sessions - Get all sessions`);
  log.debug(`  GET /api/health - Health check`);

  // Cleanup any orphaned containers from previous runs
  await cleanupOrphanedContainers();
});
