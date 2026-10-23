
const express = require("express");
const mongoose = require("mongoose");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const Withdrawal = require("../models/Withdrawal");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

const balanceFields = {
  VES: "ves",
  SVES: "sves",
  GEMS: "gems",
  TOKENS: "tokens",
  SPINS: "spins"
};

 // GET /api/admin/withdrawals?page=1&limit=10&status=PENDING
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
      );

      const allowedStatuses = [
        "PENDING",
        "PROCESSING",
        "APPROVED",
        "REJECTED",
        "CANCELLED"
      ];

      const filter = {};

      if (req.query.status) {
        if (!allowedStatuses.includes(req.query.status)) {
          return res.status(400).json({
            success: false,
            message: "Invalid withdrawal status filter."
          });
        }

        filter.status = req.query.status;
      }

      const [withdrawals, total] = await Promise.all([
        Withdrawal.find(filter)
          .select("-payoutDetails")
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Withdrawal.countDocuments(filter)
      ]);

      return res.status(200).json({
        success: true,
        message: "Withdrawals fetched successfully.",
        data: {
          withdrawals: withdrawals.map((withdrawal) => ({
            id: withdrawal._id,
            userId: withdrawal.userId,
            payoutMethod: withdrawal.payoutMethod,
            payoutAmount: withdrawal.payoutAmount,
            currency: withdrawal.currency,
            currencyType: withdrawal.currencyType,
            vesRequired: withdrawal.vesRequired,
            status: withdrawal.status,
            processedAt: withdrawal.processedAt,
            rejectionReason: withdrawal.rejectionReason || null,
            createdAt: withdrawal.createdAt
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error("List withdrawals error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch withdrawals."
      });
    }
  }
);

 // GET /api/admin/withdrawals/:id
router.get(
  "/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "A valid withdrawal ID is required."
        });
      }

      const withdrawal = await Withdrawal.findById(id)
        .select("-payoutDetails");

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: "Withdrawal not found."
        });
      }

      return res.status(200).json({
        success: true,
        message: "Withdrawal fetched successfully.",
        withdrawal: {
          id: withdrawal._id,
          userId: withdrawal.userId,
          payoutMethod: withdrawal.payoutMethod,
          payoutAmount: withdrawal.payoutAmount,
          currency: withdrawal.currency,
          currencyType: withdrawal.currencyType,
          vesRequired: withdrawal.vesRequired,
          status: withdrawal.status,
          processedAt: withdrawal.processedAt,
          rejectionReason: withdrawal.rejectionReason || null,
          createdAt: withdrawal.createdAt
        }
      });
    } catch (error) {
      console.error("Get withdrawal error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch withdrawal."
      });
    }
  }
);

// PATCH /api/admin/withdrawals/:id/status
router.patch(
  "/:id/status",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const session = await mongoose.startSession();

    try {
      const { id } = req.params;
      const { status, rejectionReason } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "A valid withdrawal ID is required."
        });
      }

      const allowedStatuses = [
        "PROCESSING",
        "APPROVED",
        "REJECTED",
        "CANCELLED"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid withdrawal status."
        });
      }

      if (
        status === "REJECTED" &&
        (typeof rejectionReason !== "string" ||
          !rejectionReason.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: "A rejection reason is required."
        });
      }

      let result;

      await session.withTransaction(async () => {
        const withdrawal = await Withdrawal.findById(id).session(session);

        if (!withdrawal) {
          const error = new Error("Withdrawal not found.");
          error.statusCode = 404;
          throw error;
        }

        const previousStatus = withdrawal.status;

        const validTransition =
          (previousStatus === "PENDING" &&
            ["PROCESSING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) ||
          (previousStatus === "PROCESSING" &&
            ["APPROVED", "REJECTED", "CANCELLED"].includes(status));

        if (!validTransition) {
          const error = new Error(
            "This withdrawal cannot transition from its current status."
          );
          error.statusCode = 409;
          throw error;
        }

        const shouldRefund =
          status === "REJECTED" || status === "CANCELLED";

        if (shouldRefund) {
          const field = balanceFields[withdrawal.currencyType || "VES"];
          const currencyType = withdrawal.currencyType || "VES";

          if (!field) {
            const error = new Error("Unsupported withdrawal currency.");
            error.statusCode = 400;
            throw error;
          }

          const wallet = await Wallet.findOne({
            _id: withdrawal.walletId,
            userId: withdrawal.userId
          }).session(session);

          if (!wallet) {
            const error = new Error("Wallet not found.");
            error.statusCode = 404;
            throw error;
          }

          const balanceBefore = wallet[field];
          const refundAmount = withdrawal.vesRequired;

          if (
            !Number.isSafeInteger(refundAmount) ||
            refundAmount <= 0
          ) {
            const error = new Error("Invalid withdrawal refund amount.");
            error.statusCode = 400;
            throw error;
          }

          wallet[field] = balanceBefore + refundAmount;
          await wallet.save({ session });

          await WalletTransaction.create(
            [{
              userId: withdrawal.userId,
              walletId: wallet._id,
              currencyType,
              transactionType: "REVERSAL",
              amount: refundAmount,
              balanceBefore,
              balanceAfter: wallet[field],
              referenceType: "REVERSAL",
              referenceId: withdrawal._id,
              description: `Refund for ${status.toLowerCase()} withdrawal`,
              idempotencyKey: `withdrawal-refund:${withdrawal._id}`
            }],
            { session }
          );
        }

        withdrawal.status = status;

        if (status === "REJECTED") {
          withdrawal.rejectionReason = rejectionReason.trim();
        }

        if (status === "APPROVED" || status === "REJECTED" || status === "CANCELLED") {
          withdrawal.processedAt = new Date();
        }

        await withdrawal.save({ session });

        await AuditLog.create(
          [{
            userId: req.user.userId,
            action: "WITHDRAWAL_STATUS_UPDATED",
            entityType: "WITHDRAWAL",
            entityId: withdrawal._id,
            details: `Withdrawal status changed from ${previousStatus} to ${status}`,
            ipAddress: req.ip
          }],
          { session }
        );

        result = {
          id: withdrawal._id,
          status: withdrawal.status,
          processedAt: withdrawal.processedAt,
          rejectionReason: withdrawal.rejectionReason || null
        };
      });

      return res.status(200).json({
        success: true,
        message: "Withdrawal status updated successfully.",
        withdrawal: result
      });
    } catch (error) {
      console.error("Admin withdrawal status error:", error.message);

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.statusCode
            ? error.message
            : "Failed to update withdrawal status."
      });
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;
