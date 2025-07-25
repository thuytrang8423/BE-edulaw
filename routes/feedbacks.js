const express = require("express");
const router = express.Router();
const controller = require("../controllers/FeedbackController");
const { authenticateToken } = require("../middleware/auth");

router.post("/", authenticateToken, controller.create); // user gửi feedback
router.get("/", controller.getAll); // admin xem tất cả feedback
router.put("/:id", controller.update); // admin xử lý feedback
router.delete("/:id", controller.delete); // admin xóa feedback

module.exports = router;
