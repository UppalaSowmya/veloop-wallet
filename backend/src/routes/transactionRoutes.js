
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const WalletTransaction = require("../models/WalletTransaction");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page || "1", 10);
    const limit = Number.parseInt(req.query.limit || "10", 10);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100."
      });
    }

    const userId = req.user.userId;
    const filter = { userId };

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      message: "Transaction history fetched successfully",
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("Transaction history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction history"
    });
  }
});

module.exports = router;
