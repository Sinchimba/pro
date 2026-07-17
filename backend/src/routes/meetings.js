import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { config } from "../config/env.js";
import { redis } from "../config/redis.js";

const router = Router();
const JWT_SECRET = config.JWT_SECRET;

const ADJECTIVES = [
  "swift", "calm", "bright", "quiet", "bold",
  "golden", "silver", "amber", "azure", "coral",
];
const NOUNS = [
  "otter", "falcon", "harbor", "meadow", "cedar",
  "comet", "ridge", "delta", "lantern", "summit",
];

function generateRoomId() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${adjective}-${noun}-${number}`;
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token." });
    }
    req.user = user;
    next();
  });
}

// Create a meeting link (Authenticated)
router.post("/create", authenticate, async (req, res) => {
  try {
    const hostId = req.user.id;
    const roomId = generateRoomId();

    const now = new Date();
    // Expiration is set to 10 minutes initially
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); 

    await db.query(
      "INSERT INTO meetings (id, host_id, expires_at, is_used) VALUES ($1, $2, $3, $4)",
      [roomId, hostId, expiresAt, db.type === "postgres" ? false : 0]
    );

    // Save to Redis with 10-minute TTL (600 seconds)
    await redis.set(`meeting:${roomId}:status`, "pending", "EX", 10 * 60);

    console.log(`[db/redis] Meeting link created: ${roomId} by host user_id: ${hostId} with 10-min TTL.`);
    res.status(201).json({ roomId });
  } catch (err) {
    console.error("[meetings/create] error:", err);
    res.status(500).json({ error: "Failed to generate meeting link." });
  }
});

// Validate meeting link (Public)
router.post("/validate", async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: "Meeting room ID is required." });
    }

    let status = await redis.get(`meeting:${roomId}:status`);

    // Fetch from database to be absolutely sure and sync
    const result = await db.query(
      "SELECT * FROM meetings WHERE id = $1",
      [roomId]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ valid: false, error: "Meeting room not found." });
    }

    const now = new Date();
    const expiresAt = new Date(row.expires_at);

    // Check expiration
    if (expiresAt < now) {
      // If DB has expired, delete from Redis just in case
      await redis.del(`meeting:${roomId}:status`);
      return res.status(410).json({ valid: false, error: "Meeting link has expired." });
    }

    // If key not in Redis but DB shows it is valid, restore to Redis
    if (!status) {
      const isUsed = db.type === "postgres" ? row.is_used : row.is_used === 1;
      status = isUsed ? "active" : "pending";
      const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      if (remainingSeconds > 0) {
        await redis.set(`meeting:${roomId}:status`, status, "EX", remainingSeconds);
      }
    }

    const isUsed = db.type === "postgres" ? row.is_used : row.is_used === 1;

    if (!isUsed) {
      // First time join: mark as used, set first_used_at, and extend database expiration to 24 hours
      // (a reasonable meeting duration limit instead of 365 days, but can be customized)
      const extendedExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const firstUsedAt = now.toISOString();

      await db.query(
        "UPDATE meetings SET is_used = $1, first_used_at = $2, expires_at = $3 WHERE id = $4",
        [db.type === "postgres" ? true : 1, firstUsedAt, extendedExpiresAt, roomId]
      );

      // Transition Redis status to active with 24-hour expiration
      await redis.set(`meeting:${roomId}:status`, "active", "EX", 24 * 60 * 60);

      console.log(`[db/redis] Meeting link ${roomId} is now active (first used). Expiration extended.`);
    }

    res.json({ valid: true });
  } catch (err) {
    console.error("[meetings/validate] error:", err);
    res.status(500).json({ error: "Failed to validate meeting link." });
  }
});

export default router;

