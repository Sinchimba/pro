import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import meetingsRoutes from "./routes/meetings.js";
import translateRoutes from "./routes/translate.js";
import { db } from "./db/connection.js";
import { redis } from "./config/redis.js";
import jwt from "jsonwebtoken";
import { config } from "./config/env.js";
import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Save app reference to set/get IO object in routes
app.set("io", null);

const FRONTEND_URL = process.env.FRONTEND_URL || "*";
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/auth", authRoutes);
app.use("/api/meetings", meetingsRoutes);
app.use("/api/translate", translateRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

const distPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/auth") ||
    req.path.startsWith("/api") ||
    req.path.startsWith("/health")
  ) {
    return next();
  }
  res.sendFile(path.join(distPath, "index.html"));
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Socket.IO authentication and active session check middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) {
      logger.security("Socket connection blocked: Missing token", { socketId: socket.id });
      return next(new Error("Authentication error: Missing token."));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      logger.security("Socket connection blocked: Invalid token signature", { socketId: socket.id, error: err.message });
      return next(new Error("Authentication error: Invalid token."));
    }

    // Single Active Session check
    const activeToken = await redis.get(`user:session:${decoded.id}`);
    if (activeToken && activeToken !== token) {
      logger.security("Socket connection blocked: Session invalidated (logged in on another device)", { userId: decoded.id, email: decoded.email });
      return next(new Error("Authentication error: Session invalidated. Logged in from another device."));
    }

    if (!activeToken) {
      logger.security("Socket connection blocked: Session expired or logged out", { userId: decoded.id, email: decoded.email });
      return next(new Error("Authentication error: Session expired or logged out."));
    }

    // Store verified credentials in socket metadata
    socket.user = decoded;
    socket.token = token;
    next();
  } catch (err) {
    logger.error("Socket authentication middleware error", err, { socketId: socket.id });
    return next(new Error("Authentication error: Internal server error."));
  }
});

const rooms = new Map();

io.on("connection", (socket) => {
  logger.info(`Socket connected`, { socketId: socket.id, userId: socket.user?.id, email: socket.user?.email });

  // A verified user wants to join a specific room
  socket.on("join-room", async ({ roomId, displayName }) => {
    try {
      const userId = socket.user.id;
      const actualDisplayName = socket.user.name || displayName || "Guest";

      // Input Validation: Check roomId format
      if (!/^[a-z]+-[a-z]+-\d{4}$/.test(roomId)) {
        logger.security("Socket join-room rejected: Invalid room ID format", { socketId: socket.id, roomId, userId });
        socket.emit("join-error", "Invalid meeting ID format.");
        return;
      }

      // Check room in DB
      const result = await db.query("SELECT * FROM meetings WHERE id = $1", [roomId]);
      const row = result.rows[0];
      if (!row) {
        logger.security("Socket join-room rejected: Room not found", { socketId: socket.id, roomId, userId });
        socket.emit("join-error", "Meeting room not found.");
        return;
      }

      const now = new Date();
      if (new Date(row.expires_at) < now) {
        logger.info("Socket join-room rejected: Meeting expired", { socketId: socket.id, roomId, userId });
        socket.emit("join-error", "Meeting has expired.");
        return;
      }

      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        if (room.users.size >= 5) {
          logger.info("Socket join-room rejected: Room full", { socketId: socket.id, roomId, userId });
          socket.emit("room-full", { roomId, max: 5 });
          return;
        }
      }

      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Map(), hostSocketId: socket.id });
      }
      const room = rooms.get(roomId);

      const existingUsers = Array.from(room.users.entries()).map(
        ([socketId, info]) => ({ 
          socketId, 
          name: info.name,
          videoOff: info.videoOff,
          audioOff: info.audioOff
        })
      );
      socket.emit("existing-users", {
        users: existingUsers,
        hostSocketId: room.hostSocketId,
      });

      room.users.set(socket.id, {
        name: actualDisplayName,
        userId: userId,
        videoOff: false,
        audioOff: false
      });
      socket.data.roomId = roomId;

      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        name: actualDisplayName,
        videoOff: false,
        audioOff: false
      });

      logger.info(`User joined room`, { socketId: socket.id, userId, displayName: actualDisplayName, roomId });
    } catch (err) {
      logger.error("Socket join-room handler error", err, { socketId: socket.id });
      socket.emit("join-error", "An error occurred while joining the room.");
    }
  });

  // Relayed signaling events - restricted to target sockets sharing the exact same room
  socket.on("offer", ({ targetSocketId, offer }) => {
    if (!offer || typeof targetSocketId !== "string") return;
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || !room.has(targetSocketId)) {
      logger.security("Relay offer blocked: target socket not in same room", { sender: socket.id, target: targetSocketId, roomId });
      return;
    }
    io.to(targetSocketId).emit("offer", {
      fromSocketId: socket.id,
      offer,
    });
  });

  socket.on("answer", ({ targetSocketId, answer }) => {
    if (!answer || typeof targetSocketId !== "string") return;
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || !room.has(targetSocketId)) {
      logger.security("Relay answer blocked: target socket not in same room", { sender: socket.id, target: targetSocketId, roomId });
      return;
    }
    io.to(targetSocketId).emit("answer", {
      fromSocketId: socket.id,
      answer,
    });
  });

  socket.on("ice-candidate", ({ targetSocketId, candidate }) => {
    if (!candidate || typeof targetSocketId !== "string") return;
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || !room.has(targetSocketId)) {
      logger.security("Relay ICE candidate blocked: target socket not in same room", { sender: socket.id, target: targetSocketId, roomId });
      return;
    }
    io.to(targetSocketId).emit("ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
  });

  // Media toggles — room and parameter type validated
  socket.on("toggle-video", ({ roomId, enabled }) => {
    if (socket.data.roomId !== roomId || typeof enabled !== "boolean") {
      logger.security("Socket validation failed on toggle-video", { socketId: socket.id, roomId });
      return;
    }
    const room = rooms.get(roomId);
    if (room) {
      const user = room.users.get(socket.id);
      if (user) {
        user.videoOff = !enabled;
      }
    }
    socket.to(roomId).emit("user-video-toggle", {
      socketId: socket.id,
      enabled,
    });
  });

  socket.on("toggle-audio", ({ roomId, enabled }) => {
    if (socket.data.roomId !== roomId || typeof enabled !== "boolean") {
      logger.security("Socket validation failed on toggle-audio", { socketId: socket.id, roomId });
      return;
    }
    const room = rooms.get(roomId);
    if (room) {
      const user = room.users.get(socket.id);
      if (user) {
        user.audioOff = !enabled;
      }
    }
    socket.to(roomId).emit("user-audio-toggle", {
      socketId: socket.id,
      enabled,
    });
  });

  // Chat messages — room and structure validated
  socket.on("chat-message", ({ roomId, name, text, file }) => {
    if (socket.data.roomId !== roomId) {
      logger.security("Socket room validation failed on chat-message", { socketId: socket.id, roomId });
      return;
    }
    if (typeof text !== "string" || (file && (typeof file.name !== "string" || typeof file.type !== "string" || typeof file.data !== "string"))) {
      logger.security("Malformed chat-message payload rejected", { socketId: socket.id });
      return;
    }
    const displayName = socket.user.name || name || "Guest";
    socket.to(roomId).emit("chat-message", {
      socketId: socket.id,
      name: displayName,
      text,
      file,
      timestamp: Date.now(),
    });
  });

  // Reactions — room and size validated
  socket.on("reaction", ({ roomId, emoji }) => {
    if (socket.data.roomId !== roomId || typeof emoji !== "string" || emoji.length > 8) {
      logger.security("Socket validation failed on reaction", { socketId: socket.id, roomId });
      return;
    }
    socket.to(roomId).emit("reaction", {
      socketId: socket.id,
      emoji,
    });
  });

  // Raise hand — room and type validated
  socket.on("raise-hand", ({ roomId, raised }) => {
    if (socket.data.roomId !== roomId || typeof raised !== "boolean") {
      logger.security("Socket validation failed on raise-hand", { socketId: socket.id, roomId });
      return;
    }
    socket.to(roomId).emit("raise-hand", {
      socketId: socket.id,
      raised,
    });
  });

  // Sign translations — room and fields validated
  socket.on("sign-translation", ({ roomId, word, confidence, mode, name }) => {
    if (socket.data.roomId !== roomId || typeof word !== "string" || typeof confidence !== "number" || typeof mode !== "string") {
      logger.security("Socket validation failed on sign-translation", { socketId: socket.id, roomId });
      return;
    }
    const displayName = socket.user.name || name || "Guest";
    socket.to(roomId).emit("sign-translation", {
      socketId: socket.id,
      name: displayName,
      word,
      confidence,
      mode,
      timestamp: Date.now(),
    });
  });

  // Speech transcripts — room and type validated
  socket.on("speech-transcript", ({ roomId, transcript, speakerName }) => {
    if (socket.data.roomId !== roomId || typeof transcript !== "string") {
      logger.security("Socket validation failed on speech-transcript", { socketId: socket.id, roomId });
      return;
    }
    const displayName = socket.user.name || speakerName || "Guest";
    socket.volatile.to(roomId).emit("speech-transcript", {
      socketId: socket.id,
      transcript,
      speakerName: displayName,
    });
  });

  // Speech completed captions — room and type validated
  socket.on("speech-caption", ({ roomId, text, speakerName }) => {
    if (socket.data.roomId !== roomId || typeof text !== "string") {
      logger.security("Socket validation failed on speech-caption", { socketId: socket.id, roomId });
      return;
    }
    const displayName = socket.user.name || speakerName || "Guest";
    socket.to(roomId).emit("speech-caption", {
      socketId: socket.id,
      text,
      speakerName: displayName,
    });
  });

  // Speech-to-sign broadcast — room and parameters validated
  socket.on("speech-sign", ({ roomId, word, videoUrl, speakerName }) => {
    if (socket.data.roomId !== roomId || typeof word !== "string" || typeof videoUrl !== "string") {
      logger.security("Socket validation failed on speech-sign", { socketId: socket.id, roomId });
      return;
    }
    const displayName = socket.user.name || speakerName || "Guest";
    socket.to(roomId).emit("speech-sign", {
      socketId: socket.id,
      word,
      videoUrl,
      speakerName: displayName,
    });
  });

  socket.on("leave-room", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected`, { socketId: socket.id, userId: socket.user?.id });
    leaveCurrentRoom(socket);
  });

  function leaveCurrentRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room) {
      room.users.delete(socket.id);

      // Host migration if host left
      if (room.hostSocketId === socket.id) {
        const next = room.users.keys().next();
        room.hostSocketId = next.done ? null : next.value;
        if (room.hostSocketId) {
          io.to(roomId).emit("host-changed", room.hostSocketId);

          const newHostUser = room.users.get(room.hostSocketId);
          if (newHostUser && newHostUser.userId) {
            db.query("UPDATE meetings SET host_id = $1 WHERE id = $2", [newHostUser.userId, roomId])
              .then(() => logger.info(`Host migrated successfully`, { newHostId: newHostUser.userId, roomId }))
              .catch(err => logger.error("Host migration DB update failed", err, { roomId }));
          }
        }
      }

      if (room.users.size === 0) {
        rooms.delete(roomId);
        redis.del(`meeting:${roomId}:status`)
          .catch(err => logger.error("Failed to delete expired meeting key from Redis", err, { roomId }));

        const nowStr = new Date().toISOString();
        db.query("UPDATE meetings SET expires_at = $1 WHERE id = $2", [nowStr, roomId])
          .then(() => logger.info("Meeting expired because all participants left", { roomId }))
          .catch(err => logger.error("DB room expiration mark failed", err, { roomId }));
      }
    }

    socket.to(roomId).emit("user-left", socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;
  }
});

const PORT = config.PORT || 4000;
httpServer.listen(PORT, () => {
  logger.info(`Signaling server listening`, { port: PORT });
});