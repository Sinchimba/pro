import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import healthRoutes from "./routes/health.js";
import "./db/connection.js";
import { config } from "./config/env.js";
import { setupSignaling } from "./sockets/signaling.js";

const app = express();

// In production (Render), set FRONTEND_URL to your deployed frontend's
// exact URL so only your own site can talk to this backend. Falls back
// to allowing everything, which is fine for local development.
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use("/auth", authRoutes);

// Simple health check — useful once this is deployed on Render,
// so you can confirm the service is alive before debugging WebRTC.
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

const httpServer = createServer(app);

// Socket.io server, using the same origin restriction as above.
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});