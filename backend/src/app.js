
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const walletRoutes = require("./routes/walletRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const walletCreditRoutes = require("./routes/walletCreditRoutes");
const payoutRoutes = require("./routes/payoutRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const adminWithdrawalRoutes = require("./routes/adminWithdrawalRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

// Stricter limit for login and registration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later."
  }
});

// Apply general limit to API routes
app.use("/api", apiLimiter);

// Apply stricter limit to authentication routes
app.use("/api/auth", authLimiter);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/wallet/credits", walletCreditRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin/withdrawals", adminWithdrawalRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "VELoop Wallet API is running"
  });
});

module.exports = app;

// Start the server only when this file is executed directly.
if (require.main === module) {
  const startServer = async () => {
    try {
      await connectDB();

      const PORT = process.env.PORT || 5000;

      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error.message);
      process.exitCode = 1;
    }
  };

  startServer();
}
