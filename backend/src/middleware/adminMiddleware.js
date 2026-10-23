
const User = require("../models/User");

const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("role status");

    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Active user account required."
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required."
      });
    }

    next();
  } catch (error) {
    console.error("Admin authorization error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Authorization check failed."
    });
  }
};

module.exports = adminMiddleware;
