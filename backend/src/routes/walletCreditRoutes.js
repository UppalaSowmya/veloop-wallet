
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { creditWallet } = require("../services/walletService");

const router = express.Router();

router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {

const { userId, currencyType, amount, description } = req.body;

const idempotencyKey =
  req.body.idempotencyKey || req.get("Idempotency-Key");


    const result = await creditWallet({
      userId,
      currencyType,
      amount,
      referenceType: "ADMIN",
      description: description || "Admin wallet credit",
      idempotencyKey
    });

    return res.status(200).json({
      success: true,
      message: result.duplicate
        ? "This credit was already processed."
        : "Wallet credited successfully.",
      duplicate: result.duplicate,
      wallet: {
        ves: result.wallet.ves,
        sves: result.wallet.sves,
        gems: result.wallet.gems,
        tokens: result.wallet.tokens,
        spins: result.wallet.spins
      },
      transaction: result.transaction
    });
  } catch (error) {
    const knownErrors = [
      "Invalid user ID.",
      "Amount must be a positive whole number.",
      "A valid idempotency key is required.",
      "Invalid wallet currency.",
      "Invalid credit reference type.",
      "Wallet not found.",
      "Wallet balance limit exceeded.",
      "Idempotency key was already used with different credit details."
    ];

    if (knownErrors.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error("Admin wallet credit error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to credit wallet."
    });
  }
});

module.exports = router;
