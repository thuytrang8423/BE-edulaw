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

router.post("/verify-email-code", authController.verifyEmailCode.bind(authController));

router.post("/resend-verification", authController.resendVerification.bind(authController));

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

router.post("/google", authController.loginWithGoogle.bind(authController));

// Protected routes
router.get("/me", authenticateToken, authController.getMe.bind(authController));
router.post("/logout", authenticateToken, authController.logout.bind(authController));
router.put('/profile', authenticateToken, authController.updateProfile.bind(authController));

// CRUD user (admin)
router.get("/users", authenticateToken, authorize('admin'), authController.getAllUsers.bind(authController));
router.get("/users/:id", authenticateToken, authorize('admin'), authController.getUserById.bind(authController));
router.put("/users/:id", authenticateToken, authorize('admin'), authController.updateUser.bind(authController));
router.delete("/users/:id", authenticateToken, authorize('admin'), authController.deleteUser.bind(authController));

module.exports = router;
