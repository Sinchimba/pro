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

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/health", healthRoutes);

const httpServer = createServer(app);

// Socket.io server. In production (Render) you can restrict
// origin to your actual frontend URL instead of "*".
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Mount socket handlers
setupSignaling(io);

const PORT = config.PORT;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});