import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const userNames = new Map<string, string>();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);
    userNames.set(socket.id, name);

    // Get other users in room
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherClients = clients.filter((id) => id !== socket.id);

    // Send existing users to the new joiner
    const usersInRoom = otherClients.map((id) => ({
      socketId: id,
      name: userNames.get(id) || "Unknown",
    }));
    socket.emit("all-users", usersInRoom);

    // Notify others a new user joined
    socket.to(roomId).emit("user-joined", { socketId: socket.id, name });
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", { offer, senderId: socket.id });
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", { answer, senderId: socket.id });
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", { candidate });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    userNames.delete(socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
