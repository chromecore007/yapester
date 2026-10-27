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
    }).select("_id name username email profilePic bio");

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

// 🔥 MOOD ANALYSIS ROUTE (Jo pehle hat gaya tha, ab wapas add kar diya hai)
router.post("/analyze-mood", protect, async (req, res) => {
  try {
    const { targetUserId, hoursAgo } = req.body;
    const userA = req.user._id.toString();
    const userB = targetUserId;

    const conversationId = [userA, userB].sort().join("_");

    let timeLimit = new Date();
    if (hoursAgo) {
      timeLimit.setHours(timeLimit.getHours() - parseInt(hoursAgo));
    } else {
      timeLimit.setHours(0, 0, 0, 0); // Aaj ki shuruat (Midnight) se
    }

    const messages = await Message.find({
      conversationId,
      sender: userB, // Sirf samne wale bande ke messages analyze honge
      createdAt: { $gte: timeLimit }
    });

    let textBlob = messages.map((m) => m.text || "").join(" ").toLowerCase();

    let mood = "Neutral 😐";
    if (
      textBlob.includes("hehe") ||
      textBlob.includes("nice") ||
      textBlob.includes("ha") ||
      textBlob.includes("hii") ||
      textBlob.includes("haha")
    ) {
      mood = "Happy 😊";
    } else if (
      textBlob.includes("sad") ||
      textBlob.includes("kuch nahi") ||
      textBlob.includes("hmm")
    ) {
      mood = "Calm / Low 😌";
    }

    res.status(200).json({
      success: true,
      message: "Congratulation! Analysis successful.",
      mood: mood,
      count: messages.length,
    });
  } catch (error) {
    console.error("❌ MOOD ANALYSIS ERROR:", error.message);
    res.status(500).json({ success: false, error: "Failed to analyze mood" });
  }
});

module.exports = router;
