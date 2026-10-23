
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const PayoutOption = require("../models/PayoutOption");

const router = express.Router();

router.get("/options", authMiddleware, async (req, res) => {
  try {
    const options = await PayoutOption.find({ active: true })
      .select("-metadata")
      .sort({ method: 1, payoutAmount: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Payout options fetched successfully",
      count: options.length,
      options
    });
  } catch (error) {
    console.error("Payout options error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payout options"
    });
  }
});

module.exports = router;
