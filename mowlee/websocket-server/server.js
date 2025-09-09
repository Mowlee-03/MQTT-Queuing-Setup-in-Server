const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = app.listen(3001, () => {
  console.log("🚀 WebSocket server running on port 3001");
});

const io = new Server(server, {
  cors: { origin: "*" } // allow all origins
});

// REST endpoint for PHP worker
app.use(express.json());
app.post("/message", (req, res) => {
  const { msg } = req.body;
//   console.log("📩 From PHP worker:", msg);
  io.emit("notification", msg); // broadcast to all frontends
  res.sendStatus(200);
});

io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);
});
