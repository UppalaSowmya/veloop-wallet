
const mongoose = require("mongoose");

const payoutOptionSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: [
      "UPI",
      "PAYPAL",
      "AMAZON_GIFT_CARD",
      "GOOGLE_PLAY_GIFT_CARD"
    ],
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    payoutAmount: {
      type: Number,
      required: true,
      min: 1
    },

    currency: {
      type: String,
      default: "INR"
    },

    requiredVEs: {
      type: Number,
      required: true,
      min: 1
    },

    active: {
      type: Boolean,
      default: true
    },

    eligibility: {
      type: String,
      default: "ALL"
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

payoutOptionSchema.index({
  method: 1,
  active: 1
});

module.exports = mongoose.model("PayoutOption", payoutOptionSchema);
