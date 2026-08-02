import { Router } from "express";
import { db } from "../db/connection.js";
import { redis } from "../config/redis.js";
import { authenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router = Router();

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

    logger.info("Meeting link created successfully", { roomId, hostId });
    res.status(201).json({ roomId });
  } catch (err) {
    logger.error("Failed to generate meeting link", err, { hostId: req.user?.id });
    res.status(500).json({ error: "Failed to generate meeting link." });
  }
});

// Validate meeting link (Authenticated)
router.post("/validate", authenticate, async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({ error: "Meeting room ID is required." });
    }

    // Input validation: roomId format must match generated structure exactly
    if (!/^[a-z]+-[a-z]+-\d{4}$/.test(roomId)) {
      logger.security("Invalid meeting ID format submitted", { roomId, userId });
      return res.status(400).json({ error: "Invalid meeting room ID format." });
    }

    let status = await redis.get(`meeting:${roomId}:status`);

    // Fetch from database to be absolutely sure and sync
    const result = await db.query(
      "SELECT * FROM meetings WHERE id = $1",
      [roomId]
    );

    const row = result.rows[0];
    if (!row) {
      logger.security("Meeting room not found", { roomId, userId });
      return res.status(404).json({ valid: false, error: "Meeting room not found." });
    }

    const now = new Date();
    const expiresAt = new Date(row.expires_at);

    // Check expiration
    if (expiresAt < now) {
      // If DB has expired, delete from Redis just in case
      await redis.del(`meeting:${roomId}:status`);
      logger.info("Meeting validation failed: expired", { roomId, userId });
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
      const extendedExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const firstUsedAt = now.toISOString();

      await db.query(
        "UPDATE meetings SET is_used = $1, first_used_at = $2, expires_at = $3 WHERE id = $4",
        [db.type === "postgres" ? true : 1, firstUsedAt, extendedExpiresAt, roomId]
      );

      // Transition Redis status to active with 24-hour expiration
      await redis.set(`meeting:${roomId}:status`, "active", "EX", 24 * 60 * 60);

      logger.info("Meeting activated on first join", { roomId, userId });
    }

    logger.info("Meeting link validated successfully", { roomId, userId });
    res.json({ valid: true });
  } catch (err) {
    logger.error("Failed to validate meeting link", err, { userId: req.user?.id });
    res.status(500).json({ error: "Failed to validate meeting link." });
  }
});

export default router;
