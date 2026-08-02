import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { redis } from "../config/redis.js";
import { logger } from "../utils/logger.js";

const JWT_SECRET = config.JWT_SECRET;

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      logger.security("Access denied: Missing token", { path: req.originalUrl, ip: req.ip });
      return res.status(401).json({ error: "Missing authorization token." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      logger.security("Access denied: Invalid or expired token signature", { path: req.originalUrl, ip: req.ip, error: err.message });
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    // Check if the session is still active (Single Active Session check)
    const activeToken = await redis.get(`user:session:${decoded.id}`);
    
    // If there is an active session token in Redis and it doesn't match the current one, reject it
    if (activeToken && activeToken !== token) {
      logger.security("Access denied: Session invalidated (logged in on another device)", {
        userId: decoded.id,
        email: decoded.email,
        ip: req.ip,
      });
      return res.status(401).json({ error: "Session invalidated. This account logged in from another device." });
    }

    // If there's no session token in Redis (e.g. server restarted or expired), but the JWT is still valid,
    // we can re-populate it or treat it as valid. In Single Active Session, if we want strict enforcement,
    // we require the key to exist. Let's check:
    // "Remove expired sessions automatically. Ensure users can log in again after logging out."
    // If the Redis key expired or was deleted on logout, activeToken will be null.
    // If it was deleted on logout, we should reject it because they logged out!
    // What if the server restarted and mockRedis cleared?
    // Let's check: if activeToken is null, has the session expired or did they log out?
    // In any case, if activeToken is null, we can treat it as expired / logged out to be secure.
    // Wait! Let's do that. If there's no active session key in Redis, it means they are logged out or session expired.
    if (!activeToken) {
      logger.security("Access denied: Session expired or logged out", {
        userId: decoded.id,
        email: decoded.email,
        ip: req.ip,
      });
      return res.status(401).json({ error: "Session expired or logged out. Please log in again." });
    }

    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    logger.error("Authentication middleware error", err, { path: req.originalUrl });
    return res.status(500).json({ error: "An error occurred during authentication validation." });
  }
}

export default authenticate;
