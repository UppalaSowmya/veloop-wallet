
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // Person or system that performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    // User whose wallet/account was affected
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    entityType: {
      type: String,
      required: true,
      enum: [
        "USER",
        "WALLET",
        "TRANSACTION",
        "WITHDRAWAL",
        "PAYOUT_OPTION",
        "SYSTEM"
      ]
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    // Optional business reference, such as a withdrawal or transaction ID
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },

    details: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },

    // Structured context; never put passwords or JWTs here
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },

    ipAddress: {
      type: String,
      default: null,
      maxlength: 45
    }
  },
  { timestamps: true }
);

// Useful for investigating recent events by action and entity
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
