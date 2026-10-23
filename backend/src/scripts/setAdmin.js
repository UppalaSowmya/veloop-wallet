
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

const setAdmin = async () => {
  try {
    const email = process.env.ADMIN_EMAIL;

    if (!email) {
      throw new Error("Set ADMIN_EMAIL in your .env file first.");
    }

    await connectDB();

    console.log("Connected database:", mongoose.connection.name);
    console.log("Users collection:", mongoose.connection.collection("users").collectionName);

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      throw new Error(
        "Admin account not found. Register that account before running this script."
      );
    }

    user.role = "ADMIN";
    await user.save();

    console.log(`Admin role assigned to ${user.email}.`);
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

setAdmin();
