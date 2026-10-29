```javascript
const express = require("express");
const router = express.Router();

const Message = require("../models/Message");
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");
const mongoose = require("mongoose");

// ==========================================
// 1. GET UNREAD MESSAGE COUNTS
// ==========================================
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
    console.error("UNREAD COUNT ERROR:", err.message);

    res.status(500).json({
      success: false,
      message: "Failed to get unread counts",
    });
  }
});

// ==========================================
// 2. GET CHAT LIST
// ==========================================
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

    // Sort chats by latest message
    chats.sort((a, b) => {
      return (
        new Date(b.lastMessageTime || 0) -
        new Date(a.lastMessageTime || 0)
      );
    });

    res.json(chats);
  } catch (err) {
    console.error("CHAT LIST ERROR:", err.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch chats",
    });
  }
});

// ==========================================
// 3. GET CONVERSATION MESSAGES
// ==========================================
router.get("/:userId", protect, async (req, res) => {
  try {
    const userA = req.user._id.toString();
    const userB = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userB)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const conversationId = [userA, userB].sort().join("_");

    const messages = await Message.find({
      conversationId,
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("FETCH MESSAGE ERROR:", err.message);

    res.status(500).json({
      success: false,
      message: "Failed to load messages",
    });
  }
});

// ==========================================
// 4. MOOD ANALYSIS CONFIGURATION
// ==========================================

const MOOD_KEYWORDS = {
  happy: [
    "happy",
    "happiness",
    "haha",
    "hahaha",
    "hehe",
    "lol",
    "lmao",
    "awesome",
    "amazing",
    "great",
    "good",
    "nice",
    "excellent",
    "wonderful",
    "fantastic",
    "excited",
    "yay",
    "yayyy",
    "love it",
    "thank you",
    "thanks",
    "mast",
    "badhiya",
    "accha",
    "achha",
    "khush",
    "maza aa gaya",
    "bahut accha",
    "badiya",
    "sahi hai",
    "waah",
    "wah",
    "😊",
    "😁",
    "😂",
    "❤️",
    "🥳",
    "😍",
    "😄",
  ],

  angry: [
    "angry",
    "anger",
    "mad",
    "furious",
    "irritated",
    "annoyed",
    "frustrated",
    "frustrating",
    "hate",
    "useless",
    "stupid",
    "idiot",
    "shut up",
    "leave me alone",
    "fed up",
    "damn",
    "wtf",
    "bakwas",
    "gussa",
    "gussa hu",
    "pareshan",
    "dimag mat kharab karo",
    "tang mat karo",
    "chup raho",
    "bekar",
    "faltu",
    "ghatiya",
    "😡",
    "🤬",
    "😠",
    "🙄",
  ],

  low: [
    "sad",
    "sadness",
    "upset",
    "unhappy",
    "depressed",
    "lonely",
    "alone",
    "cry",
    "crying",
    "hurt",
    "broken",
    "disappointed",
    "disappointment",
    "hopeless",
    "tired",
    "exhausted",
    "miss you",
    "miss him",
    "miss her",
    "feeling low",
    "not okay",
    "not okay today",
    "bad day",
    "nothing is going well",
    "i feel bad",
    "i feel sad",
    "kuch nahi",
    "mann nahi hai",
    "man nahi hai",
    "udaas",
    "dukhi",
    "akela",
    "akeli",
    "rona aa raha hai",
    "rone ka mann hai",
    "dil dukha",
    "accha nahi lag raha",
    "achha nahi lag raha",
    "thak gaya",
    "thak gayi",
    "pareshan hu",
    "😔",
    "😢",
    "😭",
    "💔",
    "🥺",
    "😞",
  ],
};

// ==========================================
// 5. MOOD SCORING FUNCTION
// ==========================================

function analyzeMood(text) {
  const normalizedText = text
    .toLowerCase()
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const scores = {
    happy: 0,
    angry: 0,
    low: 0,
  };

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const keyword of keywords) {
      const escapedKeyword = keyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // Match complete words/phrases instead of partial words.
      const regex = new RegExp(
        `(^|[^a-z0-9])${escapedKeyword}(?=$|[^a-z0-9])`,
        "gi"
      );

      const matches = normalizedText.match(regex);

      if (matches) {
        scores[mood] += matches.length;
      }
    }
  }

  // Neutral is the default when no mood keywords are detected.
  let detectedMood = "neutral";
  let highestScore = 0;

  for (const mood of ["happy", "angry", "low"]) {
    if (scores[mood] > highestScore) {
      highestScore = scores[mood];
      detectedMood = mood;
    }
  }

  // If multiple moods have the same highest score,
  // return neutral rather than guessing.
  const tiedMoods = Object.values(scores).filter(
    (score) => score === highestScore && score > 0
  );

  if (tiedMoods.length > 1) {
    detectedMood = "neutral";
  }

  const moodDetails = {
    neutral: {
      mood: "Neutral",
      emoji: "😐",
      description: "No clear positive or negative mood indicators found.",
    },

    happy: {
      mood: "Happy",
      emoji: "😊",
      description: "Positive or happy language detected.",
    },

    angry: {
      mood: "Angry",
      emoji: "😡",
      description: "Anger or frustration-related language detected.",
    },

    low: {
      mood: "Low",
      emoji: "😔",
      description: "Sadness or low-mood-related language detected.",
    },
  };

  return {
    ...moodDetails[detectedMood],
    scores,
  };
}

// ==========================================
// 6. ANALYZE OTHER USER'S MOOD FOR TODAY
// ==========================================
router.post("/analyze-mood", protect, async (req, res) => {
  try {
    const { targetUserId, hoursAgo } = req.body;

    const currentUserId = req.user._id.toString();

    // Validate target user ID.
    if (
      !targetUserId ||
      !mongoose.Types.ObjectId.isValid(targetUserId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid targetUserId is required",
      });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Choose another user to analyze their messages",
      });
    }

    // Validate the time range, if supplied.
    if (
      hoursAgo !== undefined &&
      (
        !Number.isInteger(Number(hoursAgo)) ||
        Number(hoursAgo) <= 0 ||
        Number(hoursAgo) > 720
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "hoursAgo must be between 1 and 720",
      });
    }

    const targetUserExists = await User.exists({
      _id: targetUserId,
    });

    if (!targetUserExists) {
      return res.status(404).json({
        success: false,
        message: "Target user not found",
      });
    }

    // Create a consistent conversation ID.
    const conversationId = [
      currentUserId,
      targetUserId,
    ].sort().join("_");

    // Today starts at midnight in the server's local timezone.
    const timeLimit = new Date();

    if (hoursAgo !== undefined) {
      timeLimit.setTime(
        timeLimit.getTime() -
        Number(hoursAgo) * 60 * 60 * 1000
      );
    } else {
      timeLimit.setHours(0, 0, 0, 0);
    }

    // Fetch only messages sent by the target user.
    const messages = await Message.find({
      conversationId,
      sender: targetUserId,
      createdAt: {
        $gte: timeLimit,
        $lte: new Date(),
      },
    })
      .select("text createdAt")
      .sort({ createdAt: 1 });

    // Handle cases where the target user hasn't sent any messages.
    if (messages.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No messages available for mood analysis.",
        mood: "Neutral",
        emoji: "😐",
        description: "There are no messages to analyze in this time range.",
        count: 0,
        periodHours: hoursAgo
          ? Number(hoursAgo)
          : null,
        scores: {
          happy: 0,
          angry: 0,
          low: 0,
        },
      });
    }

    // Combine all target user's messages.
    const textBlob = messages
      .map((message) => message.text || "")
      .join(" ");

    // Detect one of the four moods.
    const result = analyzeMood(textBlob);

    return res.status(200).json({
      success: true,
      message: "Mood analysis completed successfully.",
      mood: result.mood,
      emoji: result.emoji,
      description: result.description,
      count: messages.length,
      periodHours: hoursAgo
        ? Number(hoursAgo)
        : null,
      analyzedAt: new Date(),
      scores: result.scores,
    });
  } catch (error) {
    console.error("MOOD ANALYSIS ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to analyze mood",
    });
  }
});

module.exports = router;
```
