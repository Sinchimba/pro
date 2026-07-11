import { io, Socket } from "socket.io-client";

// Read from Vite environment variables (e.g. from .env or .env.local)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? "" : "http://localhost:4000");

// One shared socket connection for the whole app.
export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false, // we connect manually when the user joins a room
});