const redis = require("redis");

class SessionManager {
  constructor() {
    this.redisClient = null;
    this.connected = false;
    this.localCache = new Map(); // Fallback for when Redis is unavailable
  }

  async connect() {
    try {
      const redisHost = process.env.REDIS_HOST || "redis";
      const redisPort = process.env.REDIS_PORT || 6379;

      this.redisClient = redis.createClient({
        url: `redis://${redisHost}:${redisPort}`,
        socket: {
          reconnectStrategy: retries => Math.min(retries * 50, 500),
        },
      });

      this.redisClient.on("error", err => {
        console.error("Redis Client Error:", err);
        this.connected = false;
      });

      this.redisClient.on("connect", () => {
        console.log("✓ Connected to Redis for session management");
        this.connected = true;
      });

      await this.redisClient.connect();
      this.connected = true;
    } catch (error) {
      console.error("Failed to connect to Redis for sessions:", error);
      console.log("Falling back to local session storage");
      this.connected = false;
    }
  }

  async setSession(sessionId, sessionData) {
    const data = {
      ...sessionData,
      lastUpdated: new Date().toISOString(),
    };

    if (this.connected) {
      try {
        await this.redisClient.setEx(
          `session:${sessionId}`,
          sessionData.expiresIn || 1800, // 30 minutes default
          JSON.stringify(data),
        );
        return true;
      } catch (error) {
        console.error("Redis setSession error:", error);
        // Fall back to local storage
      }
    }

    // Fallback to local storage
    this.localCache.set(sessionId, data);
    return true;
  }

  async getSession(sessionId) {
    if (this.connected) {
      try {
        const data = await this.redisClient.get(`session:${sessionId}`);
        if (data) {
          return JSON.parse(data);
        }
      } catch (error) {
        console.error("Redis getSession error:", error);
        // Fall back to local storage
      }
    }

    // Fallback to local storage
    return this.localCache.get(sessionId);
  }

  async deleteSession(sessionId) {
    if (this.connected) {
      try {
        await this.redisClient.del(`session:${sessionId}`);
      } catch (error) {
        console.error("Redis deleteSession error:", error);
      }
    }

    // Also remove from local cache
    this.localCache.delete(sessionId);
    return true;
  }

  async getAllSessions() {
    if (this.connected) {
      try {
        const keys = await this.redisClient.keys("session:*");
        const sessions = [];

        for (const key of keys) {
          try {
            const data = await this.redisClient.get(key);
            if (data) {
              const sessionData = JSON.parse(data);
              sessions.push(sessionData);
            }
          } catch (error) {
            console.error(`Error parsing session data for ${key}:`, error);
          }
        }

        return sessions;
      } catch (error) {
        console.error("Redis getAllSessions error:", error);
        // Fall back to local storage
      }
    }

    // Fallback to local storage
    return Array.from(this.localCache.values());
  }

  async getSessionCount() {
    if (this.connected) {
      try {
        const keys = await this.redisClient.keys("session:*");
        return keys.length;
      } catch (error) {
        console.error("Redis getSessionCount error:", error);
      }
    }

    // Fallback to local storage
    return this.localCache.size;
  }

  async cleanup() {
    // Clean up expired sessions (Redis handles TTL automatically)
    if (!this.connected) {
      // For local cache, we need to manually clean up expired sessions
      const now = new Date();
      for (const [sessionId, session] of this.localCache.entries()) {
        const expiry = new Date(session.createdAt);
        expiry.setSeconds(expiry.getSeconds() + (session.expiresIn || 1800));

        if (now > expiry) {
          this.localCache.delete(sessionId);
        }
      }
    }
  }

  async disconnect() {
    if (this.connected && this.redisClient) {
      try {
        await this.redisClient.disconnect();
      } catch (error) {
        console.error("Error disconnecting from Redis:", error);
      }
    }
  }
}

module.exports = SessionManager;
