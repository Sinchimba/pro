import { io, Socket } from "socket.io-client";

// Change this if your backend runs on a different URL/port.
const BACKEND_URL = "http://localhost:4000";

// One shared socket connection for the whole app.
export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false, // we connect manually when the user joins a room
});