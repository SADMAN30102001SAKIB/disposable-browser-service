const express = require("express");
const Docker = require("dockerode");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const docker = new Docker();
const PORT = parseInt(process.env.PORT) || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
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

// Store active sessions
const activeSessions = new Map();

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

// Get available port
function getAvailablePort() {
  const usedPorts = new Set(
    [...activeSessions.values()].map(session => session.port),
  );
  for (
    let port = CONFIG.PORT_RANGE_START;
    port <= CONFIG.PORT_RANGE_END;
    port++
  ) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  throw new Error("No available ports");
}

// Create browser session
app.post("/api/session/create", async (req, res) => {
  try {
    // Check session limit
    if (activeSessions.size >= CONFIG.MAX_SESSIONS) {
      return res.status(429).json({
        error: "Maximum number of sessions reached. Please try again later.",
      });
    }

    const sessionId = uuidv4();
    const port = getAvailablePort();
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
    const session = {
      id: sessionId,
      containerId: container.id,
      containerName,
      port,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    activeSessions.set(sessionId, session);

    // Set cleanup timeout
    setTimeout(() => {
      cleanupSession(sessionId);
    }, CONFIG.SESSION_TIMEOUT);

    res.json({
      sessionId,
      url: `http://localhost:${port}/vnc.html`,
      expiresIn: CONFIG.SESSION_TIMEOUT / 1000,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create browser session" });
  }
});

// Get session info
app.get("/api/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Update last accessed time
  session.lastAccessed = new Date();

  res.json({
    sessionId: session.id,
    url: `http://localhost:${session.port}/vnc.html`,
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
app.get("/api/sessions/stats", (req, res) => {
  res.json({
    activeSessions: activeSessions.size,
    maxSessions: CONFIG.MAX_SESSIONS,
    availablePorts:
      CONFIG.PORT_RANGE_END - CONFIG.PORT_RANGE_START + 1 - activeSessions.size,
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size,
  });
});

// Cleanup function
async function cleanupSession(sessionId) {
  const session = activeSessions.get(sessionId);
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
    // Remove from active sessions
    activeSessions.delete(sessionId);
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
  const cleanupPromises = [...activeSessions.keys()].map(sessionId =>
    cleanupSession(sessionId),
  );

  await Promise.all(cleanupPromises);
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");

  // Cleanup all active sessions
  const cleanupPromises = [...activeSessions.keys()].map(sessionId =>
    cleanupSession(sessionId),
  );

  await Promise.all(cleanupPromises);
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  log.info(`Disposable Browser Service running on port ${PORT} (${NODE_ENV})`);
  log.info(
    `Configuration: MAX_SESSIONS=${CONFIG.MAX_SESSIONS}, PORT_RANGE=${CONFIG.PORT_RANGE_START}-${CONFIG.PORT_RANGE_END}, TIMEOUT=${CONFIG.SESSION_TIMEOUT}ms`,
  );
  log.debug(`API endpoints:`);
  log.debug(`  POST /api/session/create - Create new browser session`);
  log.debug(`  GET /api/session/:id - Get session info`);
  log.debug(`  DELETE /api/session/:id - Terminate session`);
  log.debug(`  GET /api/sessions/stats - Get session statistics`);
  log.debug(`  GET /api/health - Health check`);

  // Cleanup any orphaned containers from previous runs
  await cleanupOrphanedContainers();
});
