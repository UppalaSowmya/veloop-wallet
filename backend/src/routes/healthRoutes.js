
const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected
      ? "VELoop Wallet API and database are working"
      : "Database is not connected",
    database: databaseConnected ? "connected" : "disconnected"
  });
});

module.exports = router;
router.get("/protected", authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authentication successful",
    userId: req.user.userId
  });
});
