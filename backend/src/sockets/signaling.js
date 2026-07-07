// In-memory room tracking: { roomId: Set(socketId) }
const rooms = new Map();

export function setupSignaling(io) {
  io.on("connection", (socket) => {
    console.log(`[connect] ${socket.id}`);

    // Step 1: A user wants to join a specific room (meeting code/link).
    socket.on("join-room", (roomId) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      const roomUsers = rooms.get(roomId);

      // Tell the NEW user who is already in the room,
      // so they know who to send WebRTC offers to.
      const existingUsers = Array.from(roomUsers);
      socket.emit("existing-users", existingUsers);

      roomUsers.add(socket.id);
      socket.data.roomId = roomId;

      // Tell EVERYONE ELSE in the room that a new user joined,
      // so they can expect an incoming offer.
      socket.to(roomId).emit("user-joined", socket.id);

      console.log(`[join-room] ${socket.id} joined ${roomId}. Room size: ${roomUsers.size}`);
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

      const roomUsers = rooms.get(roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) {
          rooms.delete(roomId);
        }
      }

      socket.to(roomId).emit("user-left", socket.id);
      socket.leave(roomId);
      socket.data.roomId = null;
    }
  });
}
