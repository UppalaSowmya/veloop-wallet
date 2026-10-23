
const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
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
    currencyType: {
      type: String,
      enum: ["VES", "SVES", "GEMS", "TOKENS", "SPINS"],
      required: true
    },
    transactionType: {
      type: String,
      enum: ["CREDIT", "DEBIT", "REVERSAL"],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0
    },
    referenceType: {
  type: String,
  enum: [
    "REWARD",
    "BONUS",
    "REFERRAL",
    "DAILY_REWARD",
    "AD_REWARD",
    "GAME_REWARD",
    "WATCH_AD",
    "WITHDRAWAL",
    "ADMIN",
    "ADMIN_CREDIT",
    "ADMIN_DEBIT",
    "EXCHANGE",
    "EXCHANGE_CREDIT",
    "EXCHANGE_DEBIT",
    "CORRECTION",
    "REVERSAL"
  ],
  required: true
},

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    description: {
      type: String,
      trim: true,
      maxlength: 250
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null
    }
  },
  { timestamps: true }
);

walletTransactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
);

module.exports = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema
);
