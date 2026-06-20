const express = require("express");
const router = express.Router();
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

/* ================= CURRENT USER ================= */
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("_id name username email profilePic bio");

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/* ================= UPDATE PROFILE ================= */
router.put("/edit", protect, async (req, res) => {
  try {
    const { name, username, bio } = req.body;

    const existingUser = await User.findOne({
      username,
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already taken",
      });
    }

    const user = await User.findById(req.user._id);

    user.name = name || user.name;
    user.username = username || user.username;
    user.bio = bio || user.bio;

    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Failed to update profile",
    });
  }
});

/* ================= PROFILE PIC ================= */
router.put("/profile-pic", protect, async (req, res) => {
  try {
    const { profilePic } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePic },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Failed to update profile picture",
    });
  }
});

/* ================= ALL USERS ================= */
router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name username email profilePic bio");

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;