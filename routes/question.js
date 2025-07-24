const express = require("express");
const router = express.Router();
const controller = require("../controllers/QuestionController");
const { authenticateToken, authorize } = require("../middleware/auth");
// Thay require node-fetch bằng dynamic import để tránh lỗi ESM
const fetch = (...args) =>
  import("node-fetch").then((mod) => mod.default(...args));

// Chỉ cho admin xem toàn bộ question
router.get("/", authenticateToken, authorize("admin"), controller.getAll);

// Forward question to AIChatbot_BE
router.post("/ask", authenticateToken, async (req, res) => {
  try {
    const token = req.headers["authorization"];
    const { questionContent } = req.body;
    const response = await fetch(
      "https://aichatbotlaw.onrender.com/api/Question",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify(questionContent),
      }
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      message: "Forwarding to AIChatbot_BE failed",
      error: err.message,
    });
  }
});

module.exports = router;
