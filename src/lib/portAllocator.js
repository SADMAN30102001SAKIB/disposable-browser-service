const redis = require("redis");

/**
 * Redis-backed port allocator for safe scaling across multiple backend replicas.
 * Uses a Redis sorted set to track allocated ports with timestamps.
 * Automatically cleans up stale allocations based on TTL.
 */
class RedisPortAllocator {
  constructor({
    start,
    end,
    ttlMs = 30 * 60 * 1000,
    redisUrl = "redis://localhost:6379",
  }) {
    this.start = start;
    this.end = end;
    this.ttlMs = ttlMs;
    this.key = "disposable-browser:ports:allocated";

    this.redis = redis.createClient({ url: redisUrl });
    this.redis.on("error", err => console.error("Redis Client Error:", err));
    this.ready = false;
  }

  async init() {
    if (!this.ready) {
      await this.redis.connect();
      this.ready = true;
      console.log(
        `[Redis] Connected to ${this.redis.options?.url || "default"}`,
      );
    }
  }

  async allocate() {
    if (!this.ready) await this.init();

    const now = Date.now();
    const cutoff = now - this.ttlMs;

    // Clean up stale allocations (older than TTL)
    await this.redis.zRemRangeByScore(this.key, 0, cutoff);

    // Get currently allocated ports
    const allocated = await this.redis.zRange(this.key, 0, -1);
    const allocatedSet = new Set(allocated.map(p => parseInt(p, 10)));

    // Find first available port
    for (let port = this.start; port <= this.end; port++) {
      if (!allocatedSet.has(port)) {
        // Try to atomically reserve this port (race-safe with NX flag)
        const added = await this.redis.zAdd(
          this.key,
          [{ score: now, value: port.toString() }],
          { NX: true },
        );

        if (added === 1) {
          console.log(`[Redis] Allocated port ${port}`);
          return port;
        }
        // If added === 0, another instance took it, try next port
      }
    }

    throw new Error("No available ports in range");
  }

  async release(port) {
    if (!this.ready) return;

    const removed = await this.redis.zRem(this.key, port.toString());
    if (removed > 0) {
      console.log(`[Redis] Released port ${port}`);
    }
  }

  async getAllocatedCount() {
    if (!this.ready) return 0;
    return await this.redis.zCard(this.key);
  }

  async close() {
    if (this.redis && this.ready) {
      try {
        await this.redis.quit();
        this.ready = false;
      } catch (err) {
        console.error("Error closing Redis connection:", err);
      }
    }
  }
}

/**
 * Fallback in-memory allocator (single process only)
 */
class LocalPortAllocator {
  constructor({ start, end }) {
    this.start = start;
    this.end = end;
    this.allocated = new Set();
  }

  async init() {
    // No initialization needed
  }

  async allocate() {
    for (let port = this.start; port <= this.end; port++) {
      if (!this.allocated.has(port)) {
        this.allocated.add(port);
        return port;
      }
    }
    throw new Error("No available ports in range");
  }

  async release(port) {
    this.allocated.delete(port);
  }

  async getAllocatedCount() {
    return this.allocated.size;
  }

  async close() {
    // No cleanup needed
  }
}

module.exports = { RedisPortAllocator, LocalPortAllocator };
