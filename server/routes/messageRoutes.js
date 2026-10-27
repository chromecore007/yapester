const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const protect = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

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

    // Sirf samne wale user (targetUserId) ke messages fetch karo is conversation ke andar aur timeframe ke hisaab se
    const messages = await Message.find({
      conversationId,
      sender: userB, // Sirf samne wale bande ke messages analyze honge
      createdAt: { $gte: timeLimit }
    });

    // Simple text combination for mood detection
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
