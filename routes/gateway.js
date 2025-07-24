const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const router = express.Router();

const JWT_CONFIG = {
  secret: "supersecretkey123",
  issuer: "YourApp",
  audience: "YourAppClient",
  expiresIn: "15m",
};

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(
    token,
    JWT_CONFIG.secret,
    {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    },
    (err, user) => {
      if (err) return res.status(403).json({ message: "Invalid token" });
      req.user = user;
      next();
    }
  );
}

// Forward JSON body
router.post("/createQuestion", authenticateJWT, async (req, res) => {
  try {
    const result = await axios.post(
      "https://aichatbotlaw.onrender.com/api/questions",
      req.body,
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.message, data: err.response?.data });
  }
});

// Multer config for file upload
const upload = multer();

// Forward POST /api/Legal/upload
router.post(
  "/legal/upload",
  authenticateJWT,
  upload.single("file"),
  async (req, res) => {
    try {
      const form = new FormData();
      form.append("file", req.file.buffer, req.file.originalname);
      Object.keys(req.body).forEach((key) => form.append(key, req.body[key]));
      const result = await axios.post(
        "https://aichatbotlaw.onrender.com/api/Legal/upload",
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: req.headers.authorization,
          },
        }
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res
        .status(err.response?.status || 500)
        .json({ message: err.message, data: err.response?.data });
    }
  }
);

// Forward PUT /api/Legal/Chapter
router.put("/legal/chapter", authenticateJWT, async (req, res) => {
  try {
    const result = await axios.put(
      "https://aichatbotlaw.onrender.com/api/Legal/Chapter",
      req.body,
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.message, data: err.response?.data });
  }
});

// Forward GET /api/Legal
router.get("/legal", authenticateJWT, async (req, res) => {
  try {
    const result = await axios.get(
      "https://aichatbotlaw.onrender.com/api/Legal",
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.message, data: err.response?.data });
  }
});

// Forward GET /api/Question/{id}
router.get("/question/:id", authenticateJWT, async (req, res) => {
  try {
    const result = await axios.get(
      `https://aichatbotlaw.onrender.com/api/Question/${req.params.id}`,
      {
        headers: { Authorization: req.headers.authorization },
      }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.message, data: err.response?.data });
  }
});

// Forward POST /api/Question
router.post("/question", authenticateJWT, async (req, res) => {
  try {
    const userId = req.query.userId;
    const url = userId
      ? `https://aichatbotlaw.onrender.com/api/Question?userId=${userId}`
      : "https://aichatbotlaw.onrender.com/api/Question";
    const result = await axios.post(url, req.body, {
      headers: { Authorization: req.headers.authorization },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.message, data: err.response?.data });
  }
});

// Forward GET /api/Question/daily-history/{userId}
router.get(
  "/question/daily-history/:userId",
  authenticateJWT,
  async (req, res) => {
    try {
      const result = await axios.get(
        `https://aichatbotlaw.onrender.com/api/Question/daily-history/${req.params.userId}`,
        {
          headers: { Authorization: req.headers.authorization },
        }
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res
        .status(err.response?.status || 500)
        .json({ message: err.message, data: err.response?.data });
    }
  }
);

// Forward GET /api/Answer
router.get("/answer", authenticateJWT, async (req, res) => {
  try {
    // Forward tất cả query params
    const query = new URLSearchParams(req.query).toString();
    const url = `https://aichatbotlaw.onrender.com/api/Answer${
      query ? "?" + query : ""
    }`;
    const result = await axios.get(url, {
      headers: { Authorization: req.headers.authorization },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ message: err.message, data: err.response?.data });
  }
});

// Forward GET /chat-room/:chat_id/messages
router.get(
  "/chat-room/:chat_id/messages",
  authenticateJWT,
  async (req, res) => {
    try {
      // Forward request đến BE_AI nội bộ (vì lấy từ BE_AI, không phải backend onrender)
      const result = await axios.get(
        `http://localhost:5000/chat-room/${req.params.chat_id}/messages`,
        {
          headers: { Authorization: req.headers.authorization },
        }
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res
        .status(err.response?.status || 500)
        .json({ message: err.message, data: err.response?.data });
    }
  }
);

module.exports = router;
