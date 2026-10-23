
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },


  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
    default: "ACTIVE"
  },

  role: {
    type: String,
    enum: ["USER", "ADMIN"],
    default: "USER",
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
