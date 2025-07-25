const User = require("../models/User");
const emailService = require("../services/emailService");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

class AuthController {
  // Generate JWT tokens
  generateTokens(userId) {
    const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    });

    const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    });

    return { accessToken, refreshToken };
  }

  // Register new user
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          message: "User with this email already exists",
        });
      }

      // Create new user
      const user = new User({
        name,
        email,
        password,
        role: "user",
      });

      // Generate 6-digit code
      const code = user.generateEmailVerificationCode();
      await user.save();

      // Send verification email with code
      try {
        await emailService.sendVerificationEmail(user, code);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }

      res.status(201).json({
        message:
          "User registered successfully. Please check your email for the verification code.",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        message: "Registration failed",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }

  // Verify email with code
  async verifyEmailCode(req, res) {
    try {
      const { email, code } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.emailVerificationCode || !user.emailVerificationExpires) {
        return res.status(400).json({
          message: "No verification code found. Please request a new one.",
        });
      }
      if (!user.verifyEmailCode(code)) {
        return res
          .status(400)
          .json({ message: "Invalid or expired verification code" });
      }
      user.isEmailVerified = true;
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      // Gửi email chào mừng
      try {
        await emailService.sendWelcomeEmail(user);
      } catch (emailError) {
        console.error("Welcome email failed:", emailError);
      }

      res.json({
        message: "Email verified successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error("Email code verification error:", error);
      res.status(500).json({ message: "Email verification failed" });
    }
  }

  // Resend verification email
  async resendVerification(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Generate new 6-digit code
      const code = user.generateEmailVerificationCode();
      await user.save();

      // Send verification email with code
      await emailService.sendVerificationEmail(user, code);

      res.json({ message: "Verification email sent successfully" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  }

  // Login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user and include password for comparison
      const user = await User.findOne({ email }).select("+password");
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          message:
            "Account temporarily locked due to too many failed login attempts",
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res
          .status(403)
          .json({ message: "Account has been deactivated" });
      }

      // Compare password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        // Increment failed login attempts
        await user.incLoginAttempts();
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await User.updateOne(
          { _id: user._id },
          {
            $unset: { loginAttempts: 1, lockUntil: 1 },
            $set: { lastLoginAt: new Date() },
          }
        );
      } else {
        user.lastLoginAt = new Date();
        await user.save();
      }

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user._id);

      res.json({
        message: "Login successful",
        accessToken,
        refreshToken,
        userId: user._id, // Thêm userId ra ngoài
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        message: "Login failed",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token required" });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      const { accessToken, refreshToken: newRefreshToken } =
        this.generateTokens(user._id);

      res.json({
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(401).json({ message: "Invalid refresh token" });
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({
          message:
            "If an account with that email exists, we have sent a password reset code.",
        });
      }

      // Generate 6-digit code for password reset
      const code = user.generateEmailVerificationCode();
      await user.save();

      // Send password reset email with code
      try {
        await emailService.sendPasswordResetEmail(user, code);
      } catch (emailError) {
        console.error("Password reset email failed:", emailError);
        user.emailVerificationCode = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        return res.status(500).json({
          message: "Failed to send password reset email. Please try again.",
        });
      }

      res.json({
        message:
          "If an account with that email exists, we have sent a password reset code.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Password reset request failed" });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { email, code, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.emailVerificationCode || !user.emailVerificationExpires) {
        return res
          .status(400)
          .json({ message: "No reset code found. Please request a new one." });
      }
      if (!user.verifyEmailCode(code)) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }
      user.password = password;
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Password reset failed" });
    }
  }

  // Get current user
  async getMe(req, res) {
    try {
      const user = await User.findById(req.user.id);

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        },
      });
    } catch (error) {
      console.error("Get me error:", error);
      res.status(500).json({ message: "Failed to get user information" });
    }
  }

  // Lấy danh sách tất cả user (admin)
  async getAllUsers(req, res) {
    try {
      const users = await User.find();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  }

  // Lấy user theo id (admin)
  async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  }

  // Cập nhật user (admin)
  async updateUser(req, res) {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  }

  // Xóa user (admin)
  async deleteUser(req, res) {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ message: "User deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  }

  // Logout (optional - mainly for clearing client-side tokens)
  async logout(req, res) {
    res.json({ message: "Logout successful" });
  }

  // Cập nhật profile cho user hoặc admin (phải login, chỉ cập nhật chính mình)
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { name, email } = req.body;
      // Không cho phép đổi role qua API này
      const update = {};
      if (name) update.name = name;
      if (email) update.email = email;
      const user = await User.findByIdAndUpdate(userId, update, { new: true });
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  }
}

module.exports = AuthController;
