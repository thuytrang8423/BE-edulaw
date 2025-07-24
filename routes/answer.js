const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const { authenticateToken } = require("../middleware/auth");
const answerController = require("../controllers/AnswerController");

// Forward answer to AIChatbot_BE
router.post("/ask", authenticateToken, async (req, res) => {
  try {
    const token = req.headers["authorization"];
    const { answerContent } = req.body;
    const response = await fetch("http://localhost:5171/api/Answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(answerContent),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      message: "Forwarding to AIChatbot_BE failed",
      error: err.message,
    });
  }
});

// Lấy danh sách answer theo questionId và userId
router.get("/Answer", async (req, res) => {
  const { questionId, userId } = req.query;
  answerController.getAll(req, res);
});

module.exports = router;
