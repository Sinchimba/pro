import { redis } from "../config/redis.js";
import { logger } from "../utils/logger.js";

export function rateLimiter({ windowMs, max, message }) {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown-ip";
      const key = `rate-limit:${req.originalUrl}:${ip}`;
      
      const dataStr = await redis.get(key);
      const now = Date.now();
      let data = dataStr ? JSON.parse(dataStr) : { count: 0, resetTime: now + windowMs };

      // If reset time has passed, reset the bucket
      if (now > data.resetTime) {
        data = { count: 1, resetTime: now + windowMs };
      } else {
        data.count += 1;
      }

      const remainingTime = data.resetTime - now;
      
      if (data.count > max) {
        const retryAfter = Math.ceil(remainingTime / 1000);
        res.setHeader("Retry-After", retryAfter);
        logger.security("Rate limit exceeded", { ip, path: req.originalUrl, count: data.count, max });
        return res.status(429).json({
          error: message || `Too many requests. Please try again in ${retryAfter} seconds.`,
        });
      }

      // Store in Redis with TTL matching remaining reset time
      const ttlSeconds = Math.max(1, Math.ceil(remainingTime / 1000));
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
      
      next();
    } catch (err) {
      logger.error("Rate limiter middleware error", err, { path: req.originalUrl });
      // In case Redis fails, fail open to avoid locking out legitimate users, but log the error
      next();
    }
  };
}

export default rateLimiter;
