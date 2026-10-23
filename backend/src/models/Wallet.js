
const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    ves: {
      type: Number,
      default: 0,
      min: 0
    },

    sves: {
      type: Number,
      default: 0,
      min: 0
    },

    gems: {
      type: Number,
      default: 0,
      min: 0
    },

    tokens: {
      type: Number,
      default: 0,
      min: 0
    },

    spins: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Wallet", walletSchema);
