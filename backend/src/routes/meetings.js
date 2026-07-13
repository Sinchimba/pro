import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { config } from "../config/env.js";

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
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours initially

    await db.query(
      "INSERT INTO meetings (id, host_id, expires_at, is_used) VALUES ($1, $2, $3, $4)",
      [roomId, hostId, expiresAt, db.type === "postgres" ? false : 0]
    );

    console.log(`[db] Meeting link created: ${roomId} by host user_id: ${hostId}`);
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

    const result = await db.query(
      "SELECT * FROM meetings WHERE id = $1",
      [roomId]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ valid: false, error: "Meeting room not found." });
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    if (expiresAt < now) {
      return res.status(410).json({ valid: false, error: "Meeting link has expired." });
    }

    const isUsed = db.type === "postgres" ? row.is_used : row.is_used === 1;

    if (!isUsed) {
      // First time join: mark as used, set first_used_at, and extend expiration to 365 days
      const extendedExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const firstUsedAt = now.toISOString();

      await db.query(
        "UPDATE meetings SET is_used = $1, first_used_at = $2, expires_at = $3 WHERE id = $4",
        [db.type === "postgres" ? true : 1, firstUsedAt, extendedExpiresAt, roomId]
      );
      console.log(`[db] Meeting link ${roomId} is now active (first used). Expiration extended.`);
    }

    res.json({ valid: true });
  } catch (err) {
    console.error("[meetings/validate] error:", err);
    res.status(500).json({ error: "Failed to validate meeting link." });
  }
});

export default router;
