import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import translateRoutes from "./routes/translate.js";
import meetingsRoutes from "./routes/meetings.js";
import { db } from "./db/connection.js";
import { redis } from "./config/redis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// In production (Render), set FRONTEND_URL to your deployed frontend's
// exact URL so only your own site can talk to this backend. Falls back
// to allowing everything, which is fine for local development.
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/auth", authRoutes);
app.use("/api", translateRoutes);
app.use("/api/meetings", meetingsRoutes);

// Simple health check — useful once this is deployed on Render,
// so you can confirm the service is alive before debugging WebRTC.
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

// Socket.io server, using the same origin restriction as above.
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

// In-memory room tracking:
// { roomId: { users: Map<socketId, { name: string, userId: number|null, videoOff: boolean, audioOff: boolean }>, hostSocketId: string } }
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Step 1: A user wants to join a specific room (meeting code/link).
  socket.on("join-room", ({ roomId, displayName, userId }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.users.size >= 5) {
        socket.emit("room-full", { roomId, max: 5 });
        return;
      }
    }

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: new Map(), hostSocketId: socket.id });
    }
    const room = rooms.get(roomId);

    // Tell the NEW user who is already in the room (with names + who's
    // host), so they know who to send WebRTC offers to and how to label
    // the participant list.
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
      name: displayName || "Guest",
      userId: userId || null,
      videoOff: false,
      audioOff: false
    });
    socket.data.roomId = roomId;

    // Tell EVERYONE ELSE in the room that a new user joined,
    // so they can expect an incoming offer.
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      name: displayName || "Guest",
      videoOff: false,
      audioOff: false
    });

    console.log(
      `[join-room] ${socket.id} (${displayName}, userId: ${userId}) joined ${roomId}. Room size: ${room.users.size}`
    );
  });

  // Step 2: WebRTC offer/answer/ICE exchange.
  // These are just relayed — the server never looks inside them,
  // it only knows who to forward them to (targetSocketId).
  socket.on("offer", ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit("offer", {
      fromSocketId: socket.id,
      offer,
    });
  });

  socket.on("answer", ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit("answer", {
      fromSocketId: socket.id,
      answer,
    });
  });

  socket.on("ice-candidate", ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit("ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
  });

  // Media toggle states
  socket.on("toggle-video", ({ roomId, enabled }) => {
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

  // Chat messages — relayed to everyone else in the room, not persisted.
  socket.on("chat-message", ({ roomId, name, text, file }) => {
    socket.to(roomId).emit("chat-message", {
      socketId: socket.id,
      name,
      text,
      file,
      timestamp: Date.now(),
    });
  });

  // Reactions — relayed to everyone else in the room, not persisted.
  socket.on("reaction", ({ roomId, emoji }) => {
    socket.to(roomId).emit("reaction", {
      socketId: socket.id,
      emoji,
    });
  });

  // Raise hand — broadcast a toggle to everyone else in the room.
  socket.on("raise-hand", ({ roomId, raised }) => {
    socket.to(roomId).emit("raise-hand", {
      socketId: socket.id,
      raised,
    });
  });

  // Sign translations — relayed to everyone else in the room, not persisted.
  socket.on("sign-translation", ({ roomId, word, confidence, mode }) => {
    const room = rooms.get(roomId);
    const displayName = room?.users.get(socket.id)?.name || "Guest";
    socket.to(roomId).emit("sign-translation", {
      socketId: socket.id,
      name: displayName,
      word,
      confidence,
      mode,
      timestamp: Date.now(),
    });
  });

  // Speech transcripts — relayed to everyone else in the room with ultra-low latency (volatile)
  socket.on("speech-transcript", ({ roomId, transcript }) => {
    socket.volatile.to(roomId).emit("speech-transcript", {
      socketId: socket.id,
      transcript,
    });
  });

  // Speech completed captions — relayed to everyone else in the room for subtitles.
  socket.on("speech-caption", ({ roomId, text, speakerName }) => {
    socket.to(roomId).emit("speech-caption", {
      socketId: socket.id,
      text,
      speakerName,
    });
  });

  // Step 3: Cleanup when someone leaves or disconnects.
  socket.on("leave-room", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    leaveCurrentRoom(socket);
  });

  function leaveCurrentRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room) {
      room.users.delete(socket.id);

      // If the host left, hand the crown to whoever's been in the room
      // longest (the next entry in the Map, which preserves insertion order).
      if (room.hostSocketId === socket.id) {
        const next = room.users.keys().next();
        room.hostSocketId = next.done ? null : next.value;
        if (room.hostSocketId) {
          io.to(roomId).emit("host-changed", room.hostSocketId);

          // Update database meeting host if the new host is authenticated
          const newHostUser = room.users.get(room.hostSocketId);
          if (newHostUser && newHostUser.userId) {
            db.query("UPDATE meetings SET host_id = $1 WHERE id = $2", [newHostUser.userId, roomId])
              .then(() => console.log(`[db] Host migrated to user_id: ${newHostUser.userId} for room ${roomId}`))
              .catch(err => console.error("[db] Host migration DB update failed:", err));
          }
        }
      }

      if (room.users.size === 0) {
        rooms.delete(roomId);
        // Expire Redis key immediately
        redis.del(`meeting:${roomId}:status`)
          .catch(err => console.error("[redis] Failed to delete expired key:", err));

        // Mark meeting link as expired in database
        const nowStr = new Date().toISOString();
        db.query("UPDATE meetings SET expires_at = $1 WHERE id = $2", [nowStr, roomId])
          .then(() => console.log(`[db/redis] Meeting link ${roomId} expired as all participants left.`))
          .catch(err => console.error("[db] Expire room failed:", err));
      }
    }

    socket.to(roomId).emit("user-left", socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;
  }
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});