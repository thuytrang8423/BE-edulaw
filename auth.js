const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid token - user not found" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account has been deactivated" });
    }

    if (user.isLocked) {
      return res.status(423).json({ message: "Account is temporarily locked" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    res.status(500).json({ message: "Token verification failed" });
  }
};

// Check if email is verified
const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      message: "Email verification required",
      action: "EMAIL_VERIFICATION_REQUIRED",
    });
  }
  next();
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
};

// Rate limiting for sensitive operations
const createAccountLimiter = require("express-rate-limit")({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 accounts per 10 minutes
  message: {
    message:
      "Too many accounts created from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = require("express-rate-limit")({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  message: {
    message:
      "Too many login attempts from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authenticateToken,
  requireEmailVerification,
  authorize,
  createAccountLimiter,
  loginLimiter,
};
