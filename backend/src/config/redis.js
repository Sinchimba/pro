import { Redis } from "ioredis";
import { config } from "./env.js";

let redisClient = null;

if (config.REDIS_URL) {
  try {
    redisClient = new Redis(config.REDIS_URL);
    console.log("[redis] Connected to Redis successfully.");
    redisClient.on("error", (err) => {
      console.error("[redis] Redis error:", err);
    });
  } catch (err) {
    console.error("[redis] Connection failed:", err);
  }
}

// Fallback in-memory store to mimic Redis behavior locally without Redis server
const memoryStore = new Map();
const timeouts = new Map();

const mockRedis = {
  async set(key, value, mode, duration) {
    memoryStore.set(key, value);
    // Clear any existing timeout for this key
    if (timeouts.has(key)) {
      clearTimeout(timeouts.get(key));
      timeouts.delete(key);
    }
    if (mode === "EX" && duration) {
      const timeout = setTimeout(() => {
        memoryStore.delete(key);
        timeouts.delete(key);
        console.log(`[mock-redis] Key expired: ${key}`);
      }, duration * 1000);
      timeouts.set(key, timeout);
    }
    return "OK";
  },
  async get(key) {
    return memoryStore.get(key) || null;
  },
  async del(key) {
    if (timeouts.has(key)) {
      clearTimeout(timeouts.get(key));
      timeouts.delete(key);
    }
    const existed = memoryStore.has(key);
    memoryStore.delete(key);
    return existed ? 1 : 0;
  },
  async expire(key, duration) {
    if (memoryStore.has(key)) {
      if (timeouts.has(key)) {
        clearTimeout(timeouts.get(key));
      }
      const timeout = setTimeout(() => {
        memoryStore.delete(key);
        timeouts.delete(key);
        console.log(`[mock-redis] Key expired: ${key}`);
      }, duration * 1000);
      timeouts.set(key, timeout);
      return 1;
    }
    return 0;
  }
};

export const redis = redisClient || mockRedis;
export default redis;
