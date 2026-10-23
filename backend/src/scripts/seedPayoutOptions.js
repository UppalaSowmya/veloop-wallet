require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PayoutOption = require("../models/PayoutOption");

const payoutOptions = [
  // UPI options
  {
    method: "UPI",
    name: "UPI ₹10",
    payoutAmount: 10,
    currency: "INR",
    requiredVEs: 2400,
    active: true,
  },
  {
    method: "UPI",
    name: "UPI ₹25",
    payoutAmount: 25,
    currency: "INR",
    requiredVEs: 5800,
    active: true,
  },
  {
    method: "UPI",
    name: "UPI ₹50",
    payoutAmount: 50,
    currency: "INR",
    requiredVEs: 10000,
    active: true,
  },
  {
    method: "UPI",
    name: "UPI ₹100",
    payoutAmount: 100,
    currency: "INR",
    requiredVEs: 19500,
    active: true,
  },

  // PayPal test option
  {
    method: "PAYPAL",
    name: "PayPal ₹10",
    payoutAmount: 10,
    currency: "INR",
    requiredVEs: 2400,
    active: true,
  },

  // Amazon Gift Card test option
  {
    method: "AMAZON_GIFT_CARD",
    name: "Amazon Gift Card ₹10",
    payoutAmount: 10,
    currency: "INR",
    requiredVEs: 2400,
    active: true,
  },

  // Google Play Gift Card test option
  {
    method: "GOOGLE_PLAY_GIFT_CARD",
    name: "Google Play Gift Card ₹10",
    payoutAmount: 10,
    currency: "INR",
    requiredVEs: 2400,
    active: true,
  },
];

async function seedPayoutOptions() {
  try {
    await connectDB();

    for (const option of payoutOptions) {
      await PayoutOption.findOneAndUpdate(
        {
          method: option.method,
          payoutAmount: option.payoutAmount,
          currency: option.currency,
        },
        { $set: option },
        { upsert: true, runValidators: true }
      );
    }

    console.log("Payout options seeded successfully.");

    const options = await PayoutOption.find({ active: true })
      .select("-metadata")
      .sort({ method: 1, payoutAmount: 1 })
      .lean();

    console.log(`Active payout options: ${options.length}`);
    console.table(
      options.map((option) => ({
        method: option.method,
        name: option.name,
        amount: option.payoutAmount,
        requiredVEs: option.requiredVEs,
      }))
    );
  } catch (error) {
    console.error("Failed to seed payout options:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedPayoutOptions();