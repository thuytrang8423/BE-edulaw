const express = require("express");
const router = express.Router();

const AuthController = require("../controllers/authController");
const authController = new AuthController();
const {
  authenticateToken,
  createAccountLimiter,
  loginLimiter,
  authorize,
} = require("../middleware/auth");
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  handleValidationErrors,
} = require("../middleware/validation");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Public routes
router.post(
  "/register",
  createAccountLimiter,
  registerValidation,
  handleValidationErrors,
  authController.register.bind(authController)
);

router.post(
  "/login",
  loginLimiter,
  loginValidation,
  handleValidationErrors,
  authController.login.bind(authController)
);

router.post(
  "/verify-email-code",
  authController.verifyEmailCode.bind(authController)
);

router.post(
  "/resend-verification",
  authController.resendVerification.bind(authController)
);

router.post(
  "/forgot-password",
  forgotPasswordValidation,
  handleValidationErrors,
  authController.forgotPassword.bind(authController)
);

router.post(
  "/reset-password",
  resetPasswordValidation,
  handleValidationErrors,
  authController.resetPassword.bind(authController)
);

router.post("/refresh-token", authController.refreshToken.bind(authController));

// Protected routes
// Tách endpoint profile riêng

// CRUD user (admin)
router.get(
  "/users",
  authenticateToken,
  authorize("admin"),
  authController.getAllUsers.bind(authController)
);
router.get(
  "/users/:id",
  authenticateToken,
  authorize("admin"),
  authController.getUserById.bind(authController)
);
router.put(
  "/users/:id",
  authenticateToken,
  authorize("admin"),
  upload.single("avatar"),
  authController.updateUser.bind(authController)
);
router.delete(
  "/users/:id",
  authenticateToken,
  authorize("admin"),
  authController.deleteUser.bind(authController)
);

module.exports = router;
