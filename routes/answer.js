const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const answerController = require("../controllers/AnswerController");

// Lấy danh sách answer theo questionId và userId
router.get("/Answer", authenticateToken, answerController.getAll);

// (Nếu có) Tạo answer mới
// router.post("/", authenticateToken, answerController.create);

module.exports = router;
