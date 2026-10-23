
const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true
    },

    payoutOptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayoutOption",
      required: true
    },

    payoutMethod: {
  type: String,
  enum: [
    "UPI",
    "PAYPAL",
    "AMAZON_GIFT_CARD",
    "GOOGLE_PLAY_GIFT_CARD"
  ],
  required: true
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

    currencyType: {
      type: String,
      enum: ["VES"],
      default: "VES",
      required: true
    },

    vesRequired: {
      type: Number,
      required: true,
      min: 1
    },

    payoutDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      select: false
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "APPROVED",
        "REJECTED",
        "CANCELLED"
      ],
      default: "PENDING",
      required: true
    },

    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128
    },

    processedAt: {
      type: Date,
      default: null
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 250,
      default: null
    }
  },
  { timestamps: true }
);

withdrawalSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }
);

withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });



module.exports = mongoose.model("Withdrawal", withdrawalSchema);
