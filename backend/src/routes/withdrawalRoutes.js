
const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");

const Wallet = require("../models/Wallet");
const PayoutOption = require("../models/PayoutOption");
const Withdrawal = require("../models/Withdrawal");
const WalletTransaction = require("../models/WalletTransaction");
const AuditLog = require("../models/AuditLog");

const router = express.Router();

function safeWithdrawalResponse(withdrawal) {
  return {
    id: withdrawal._id,
    payoutMethod: withdrawal.payoutMethod,
    payoutAmount: withdrawal.payoutAmount,
    currency: withdrawal.currency,
    currencyType: withdrawal.currencyType,
    vesRequired: withdrawal.vesRequired,
    status: withdrawal.status,
    processedAt: withdrawal.processedAt,
    rejectionReason: withdrawal.rejectionReason || null,
    createdAt: withdrawal.createdAt,
  };
}

function validatePayoutDetails(method, details) {
  if (
    !details ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    return { valid: false };
  }

  const keys = Object.keys(details);

  if (method === "UPI") {
    if (
      keys.length !== 1 ||
      keys[0] !== "upiId" ||
      typeof details.upiId !== "string"
    ) {
      return { valid: false };
    }

    const upiId = details.upiId.trim();

    // Format validation only; this does not verify a real UPI ID.
    if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upiId)) {
      return { valid: false };
    }

    return {
      valid: true,
      details: { upiId },
    };
  }

  if (method === "PAYPAL") {
    if (
      keys.length !== 1 ||
      keys[0] !== "email" ||
      typeof details.email !== "string"
    ) {
      return { valid: false };
    }

    const email = details.email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return { valid: false };
    }

    return {
      valid: true,
      details: { email },
    };
  }

  if (
    method === "AMAZON_GIFT_CARD" ||
    method === "GOOGLE_PLAY_GIFT_CARD"
  ) {
    if (keys.length !== 0) {
      return { valid: false };
    }

    return {
      valid: true,
      details: {},
    };
  }

  return { valid: false };
}

function sameDetails(first, second) {
  const firstKeys = Object.keys(first || {}).sort();
  const secondKeys = Object.keys(second || {}).sort();

  return (
    JSON.stringify(firstKeys) === JSON.stringify(secondKeys) &&
    firstKeys.every((key) => first[key] === second[key])
  );
}

function sameRequest(existing, optionId, details) {
  return (
    String(existing.payoutOptionId) === String(optionId) &&
    sameDetails(existing.payoutDetails, details)
  );
}

router.post("/", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { payoutOptionId, payoutDetails } = req.body || {};
  const headerKey = req.get("Idempotency-Key");

  if (!mongoose.isValidObjectId(payoutOptionId)) {
    return res.status(400).json({
      success: false,
      message: "A valid payout option ID is required.",
    });
  }

  if (
    typeof headerKey !== "string" ||
    headerKey.trim().length < 8 ||
    headerKey.trim().length > 128
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide an Idempotency-Key header between 8 and 128 characters.",
    });
  }

  if (
    !payoutDetails ||
    typeof payoutDetails !== "object" ||
    Array.isArray(payoutDetails)
  ) {
    return res.status(400).json({
      success: false,
      message: "Payout details are required.",
    });
  }

  const key = headerKey.trim();
  let session;

  try {
    session = await mongoose.startSession();

    let result;

    await session.withTransaction(async () => {
      const option = await PayoutOption.findOne({
        _id: payoutOptionId,
        active: true,
      }).session(session);

      if (!option) {
        throw new Error("PAYOUT_OPTION_NOT_FOUND");
      }

      const validation = validatePayoutDetails(
        option.method,
        payoutDetails
      );

      if (!validation.valid) {
        throw new Error("INVALID_PAYOUT_DETAILS");
      }

      const normalizedDetails = validation.details;


const existingQuery = Withdrawal.findOne({
  userId,
  idempotencyKey: key,
});

const existing =
  typeof existingQuery.select === "function"
    ? await existingQuery.select("+payoutDetails").session(session)
    : await existingQuery;


      if (existing) {
        if (!sameRequest(existing, option._id, normalizedDetails)) {
          throw new Error("IDEMPOTENCY_KEY_REUSED");
        }

        result = {
          withdrawal: existing,
          duplicate: true,
        };

        return;
      }

      const wallet = await Wallet.findOne({ userId }).session(session);

      if (!wallet) {
        throw new Error("WALLET_NOT_FOUND");
      }

      const amount = option.requiredVEs;
      const balanceBefore = wallet.ves;

      if (balanceBefore < amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Atomically deduct only when sufficient balance remains.
      const updatedWallet = await Wallet.findOneAndUpdate(
        {
          _id: wallet._id,
          userId,
          ves: { $gte: amount },
        },
        {
          $inc: { ves: -amount },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!updatedWallet) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const [withdrawal] = await Withdrawal.create(
        [
          {
            userId,
            walletId: wallet._id,
            payoutOptionId: option._id,
            payoutMethod: option.method,
            payoutAmount: option.payoutAmount,
            currency: option.currency,
            currencyType: "VES",
            vesRequired: amount,
            payoutDetails: normalizedDetails,
            status: "PENDING",
            idempotencyKey: key,
          },
        ],
        { session }
      );

      await WalletTransaction.create(
        [
          {
            userId,
            walletId: wallet._id,
            currencyType: "VES",
            transactionType: "DEBIT",
            amount,
            balanceBefore,
            balanceAfter: updatedWallet.ves,
            referenceType: "WITHDRAWAL",
            referenceId: withdrawal._id,
            description: `Withdrawal request for ${option.name}`,
            idempotencyKey: `withdrawal:${withdrawal._id}`,
          },
        ],
        { session }
      );

      await AuditLog.create(
        [
          {
            userId,
            action: "WITHDRAWAL_REQUESTED",
            entityType: "WITHDRAWAL",
            entityId: withdrawal._id,
            details: `Withdrawal request created for ${option.name}`,
            ipAddress: req.ip,
          },
        ],
        { session }
      );

      result = {
        withdrawal,
        duplicate: false,
      };
    });

    if (!result) {
      throw new Error("WITHDRAWAL_RESULT_MISSING");
    }

    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "This withdrawal request was already submitted."
        : "Withdrawal request submitted successfully. It is awaiting processing.",
      duplicate: result.duplicate,
      withdrawal: safeWithdrawalResponse(result.withdrawal),
    });
  } catch (error) {
    // Handle duplicate-key races without relying on .select() in test mocks.
    if (error.code === 11000) {
      try {
       const existingQuery = Withdrawal.findOne({
          userId,
          idempotencyKey: key,
        });

        const existing =
          typeof existingQuery.select === "function"
            ? await existingQuery.select("+payoutDetails")
            : await existingQuery;

        if (existing) {
          const option = await PayoutOption.findById(payoutOptionId);

          if (option) {
            const validation = validatePayoutDetails(
              option.method,
              payoutDetails
            );

            if (
              validation.valid &&
              sameRequest(existing, option._id, validation.details)
            ) {
              return res.status(200).json({
                success: true,
                message: "This withdrawal request was already submitted.",
                duplicate: true,
                withdrawal: safeWithdrawalResponse(existing),
              });
            }
          }

          return res.status(409).json({
            success: false,
            message:
              "Idempotency key was already used for a different request.",
          });
        }
      } catch (lookupError) {
        console.error(
          "Duplicate withdrawal lookup error:",
          lookupError.message
        );
      }
    }

    const errors = {
      PAYOUT_OPTION_NOT_FOUND: [
        404,
        "Payout option not found or inactive.",
      ],
      INVALID_PAYOUT_DETAILS: [
        400,
        "Payout details are invalid for this method.",
      ],
      WALLET_NOT_FOUND: [
        404,
        "Wallet not found.",
      ],
      INSUFFICIENT_BALANCE: [
        400,
        "Insufficient VEs for this withdrawal.",
      ],
      IDEMPOTENCY_KEY_REUSED: [
        409,
        "Idempotency key was already used for a different request.",
      ],
    };

    const known = errors[error.message];

    if (known) {
      return res.status(known[0]).json({
        success: false,
        message: known[1],
      });
    }

    console.error("Withdrawal request error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create withdrawal request.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
});


// Get withdrawal history for the logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find({ userId })
        .select("-payoutDetails")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Withdrawal.countDocuments({ userId }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Withdrawal history fetched successfully",
      data: {
        withdrawals: withdrawals.map((withdrawal) => ({
          id: withdrawal._id,
          payoutMethod: withdrawal.payoutMethod,
          payoutAmount: withdrawal.payoutAmount,
          currency: withdrawal.currency,
          currencyType: withdrawal.currencyType,
          vesRequired: withdrawal.vesRequired,
          status: withdrawal.status,
          processedAt: withdrawal.processedAt,
          rejectionReason: withdrawal.rejectionReason || null,
          createdAt: withdrawal.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Withdrawal history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal history.",
    });
  }
});

module.exports = router;
