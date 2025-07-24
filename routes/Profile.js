const express = require("express");
const router = express.Router();

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../services/cloudinary");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "avatars",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 256, height: 256, crop: "limit" }],
    resource_type: "image"
  },
});
const upload = multer({ storage });

// GET /profile - lấy thông tin user hiện tại
router.get("/profile/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get profile" });
  }
});

// PUT /profile - cập nhật profile, đổi avatar
router.put(
  "/profile/me",
  authenticateToken,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { name, email } = req.body;
      const update = {};
      let needVerifyEmail = false;
      let newVerifyCode = null;
      let newEmail = null;
      if (name) update.name = name;
      if (email) {
        // Check email đã tồn tại chưa
        const existing = await User.findOne({ email, _id: { $ne: userId } });
        if (existing)
          return res
            .status(400)
            .json({ message: "Email đã được sử dụng bởi tài khoản khác." });
        update.email = email;
        update.isEmailVerified = false;
        // Sinh mã xác thực mới
        newVerifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        update.emailVerificationCode = newVerifyCode;
        update.emailVerificationExpires = Date.now() + 15 * 60 * 1000; // 15 phút
        needVerifyEmail = true;
        newEmail = email;
      }
      if (req.file && req.file.path) update.avatar = req.file.path; // URL Cloudinary
      const user = await User.findByIdAndUpdate(userId, update, { new: true });
      if (!user) return res.status(404).json({ message: "User not found" });
      // Nếu đổi email, gửi lại mã xác thực
      if (needVerifyEmail && newVerifyCode && newEmail) {
        const emailService = require("../services/emailService");
        await emailService.sendVerificationCode(newEmail, newVerifyCode);
      }
      res.json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
        needVerifyEmail,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res
        .status(500)
        .json({ message: "Failed to update profile", error: error.message });
    }
  }
);

module.exports = router;
