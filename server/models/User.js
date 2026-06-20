const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },
    
    profilePic: {
  type: String,
  default: "",
},
bio: {
  type: String,
  default: "Stay positive, work hard 👋",
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
