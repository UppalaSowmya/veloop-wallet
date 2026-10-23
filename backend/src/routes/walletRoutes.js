
const express = require("express");
const Wallet = require("../models/Wallet");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/wallet
router.get("/", authMiddleware, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({
      userId: req.user.userId
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet fetched successfully",
      wallet: {
        id: wallet._id,
        ves: wallet.ves,
        sves: wallet.sves,
        gems: wallet.gems,
        tokens: wallet.tokens,
        spins: wallet.spins
      }
    });
  } catch (error) {
    console.error("Get wallet error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wallet"
    });
  }
});

module.exports = router;
