const express = require("express");
const router = express.Router();
const controller = require("../controllers/QuestionController");
const { authenticateToken, authorize } = require("../middleware/auth");

// Chỉ cho admin xem toàn bộ question
router.get("/", authenticateToken, authorize("admin"), controller.getAll);

// Tạo question mới
router.post("/", authenticateToken, controller.create);

// Lấy chi tiết question theo id
router.get("/:id", authenticateToken, controller.getById);

module.exports = router;
