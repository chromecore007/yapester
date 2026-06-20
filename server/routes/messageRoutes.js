const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");
const mongoose = require("mongoose");

router.get("/unread/count", protect, async (req, res) => {
  try {
    const counts = await Message.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(req.user._id),
          status: { $ne: "seen" },
        },
      },
      {
        $group: {
          _id: "$sender",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(counts);
  } catch (err) {
    res.status(500).json({ message: "Failed to get unread counts" });
  }
});
router.get("/chats/list", protect, async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();

    const messages = await Message.find({
      $or: [
        { sender: currentUserId },
        { receiver: currentUserId },
      ],
    }).sort({ createdAt: -1 });

    const chatMap = new Map();

    for (const msg of messages) {
      const otherUserId =
        msg.sender.toString() === currentUserId
          ? msg.receiver.toString()
          : msg.sender.toString();

      if (!chatMap.has(otherUserId)) {
        chatMap.set(otherUserId, msg);
      }
    }

    const users = await User.find({
      _id: { $in: [...chatMap.keys()] },
    }).select("_id name username email profilePic");

    const chats = users.map((user) => {
      const lastMessage = chatMap.get(user._id.toString());

      return {
        ...user.toObject(),
        lastMessage: lastMessage?.text || "",
        lastMessageTime: lastMessage?.createdAt || null,
      };
    });

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch chats",
    });
  }
});

router.get("/:userId", protect, async (req, res) => {
  try {
    const userA = req.user._id.toString();
    const userB = req.params.userId;

    const conversationId = [userA, userB].sort().join("_");

    const messages = await Message.find({ conversationId }).sort("createdAt");

    res.json(messages);
  } catch (err) {
    console.error("❌ FETCH ERROR:", err.message);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

module.exports = router;
