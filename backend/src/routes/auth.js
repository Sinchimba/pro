import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { config } from "../config/env.js";
import { redis } from "../config/redis.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { authenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

const JWT_SECRET = config.JWT_SECRET;
const VALID_ROLES = ["normal", "deaf", "mute"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate Limiters
const loginLimiter = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: "Too many login attempts. Please try again after 60 seconds.",
});

const signupLimiter = rateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: "Too many accounts created from this IP. Please try again later.",
});

// Helper: Disconnect any active sockets for this user ID
async function disconnectActiveSockets(req, userId) {
  const io = req.app.get("io");
  if (!io) return;
  try {
    const sockets = await io.fetchSockets();
    for (const s of sockets) {
      if (s.user && s.user.id === userId) {
        logger.security("Evicting existing socket connection for multiple logins check", {
          userId,
          socketId: s.id,
        });
        s.emit("session-invalidated", {
          message: "This account has logged in on another device.",
        });
        s.disconnect(true);
      }
    }
  } catch (err) {
    logger.error("Failed to disconnect active sockets for user", err, { userId });
  }
}

router.post("/signup", signupLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Missing fields validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // 2. Input format validations
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }
    if (!/^[a-zA-Z0-9\s'-]+$/.test(trimmedName)) {
      return res.status(400).json({ error: "Name contains invalid characters." });
    }

    if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 255) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: "Password must be between 6 and 72 characters." });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role selected." });
    }

    // 3. Check for existing user
    const existingResult = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [trimmedEmail]
    );
    const existing = existingResult.rows[0];
    if (existing) {
      logger.security("Signup attempt with existing email", { email: trimmedEmail });
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // 4. Secure hashing
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [trimmedName, trimmedEmail, passwordHash, role]
    );

    const userId = result.rows[0].id;
    const user = {
      id: userId,
      name: trimmedName,
      email: trimmedEmail,
      role,
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

    // Evict any existing socket sessions for safety
    await disconnectActiveSockets(req, userId);

    // Save active session token to Redis with 7-day TTL (604800 seconds)
    await redis.set(`user:session:${userId}`, token, "EX", 7 * 24 * 60 * 60);

    logger.info("User signed up and session created", { userId, email: trimmedEmail });
    res.status(201).json({ user, token });
  } catch (err) {
    logger.error("Signup error", err);
    res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [trimmedEmail]
    );
    const row = result.rows[0];
    if (!row) {
      logger.security("Login failure: Email not found", { email: trimmedEmail });
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, row.password_hash);
    if (!passwordMatches) {
      logger.security("Login failure: Password mismatch", { email: trimmedEmail, userId: row.id });
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

    // Evict any existing socket sessions first
    await disconnectActiveSockets(req, row.id);

    // Save active session token to Redis with 7-day TTL (604800 seconds)
    await redis.set(`user:session:${row.id}`, token, "EX", 7 * 24 * 60 * 60);

    logger.info("User logged in successfully", { userId: row.id, email: trimmedEmail });
    res.json({ user, token });
  } catch (err) {
    logger.error("Login error", err);
    res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

// Explicit Logout Endpoint
router.post("/logout", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Invalidate the session in Redis
    await redis.del(`user:session:${userId}`);
    
    // Disconnect any active sockets for this user
    await disconnectActiveSockets(req, userId);
    
    logger.info("User logged out successfully", { userId });
    res.json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    logger.error("Logout error", err, { userId: req.user?.id });
    res.status(500).json({ error: "An unexpected error occurred during logout." });
  }
});

export default router;