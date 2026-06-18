const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const Message = require("./models/Message");

dotenv.config();
connectDB();

const app = express();

/* ================= CORS (API) ================= */
app.use(
  cors({
    origin: "*", // 🔥 Vercel / any frontend
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/follow", require("./routes/followRoutes"));

const server = http.createServer(app);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: "*", // 🔥 IMPORTANT (localhost hata diya)
    methods: ["GET", "POST"],
  },
});

const onlineUsers = new Set();

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  socket.on("join", (userId) => {
    socket.userId = userId;
    socket.join(userId);
    onlineUsers.add(userId);
    io.emit("onlineUsers", Array.from(onlineUsers));
  });

  /* ================= SEND MESSAGE ================= */
  socket.on("privateMessage", async ({ sender, receiver, text }) => {
    try {
      const conversationId = [sender, receiver].sort().join("_");

      // 1️⃣ DB save → SENT ✔
      const msg = await Message.create({
        sender,
        receiver,
        text,
        conversationId,
        status: "sent",
      });

      // 2️⃣ Sender ko → SENT ✔
      io.to(sender).emit("newMessage", {
        ...msg._doc,
        status: "sent",
      });

      // 3️⃣ Receiver ko → DELIVERED ✔✔
      io.to(receiver).emit("newMessage", {
        ...msg._doc,
        status: "delivered",
      });
      io.to(receiver).emit("unreadIncrement", {
  senderId: sender,
});
    } catch (err) {
      console.error("❌ Message error:", err.message);
    }
  });

  /* ================= SEEN ================= */
  socket.on("seenMessage", async ({ sender, receiver }) => {
    try {
      const conversationId = [sender, receiver].sort().join("_");

      const updated = await Message.updateMany(
        {
          conversationId,
          receiver,
          status: { $ne: "seen" },
        },
        { $set: { status: "seen" } }
      );

      if (updated.modifiedCount > 0) {
        io.to(sender).emit("messageSeen", { conversationId });
      }
    } catch (err) {
      console.error("❌ Seen error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit("onlineUsers", Array.from(onlineUsers));
    }
    console.log("❌ Disconnected");
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on ${PORT}`)
);
