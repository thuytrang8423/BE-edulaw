const express = require("express");
const router = express.Router();
const ChatRoomController = require("../controllers/ChatRoomController");
const axios = require("axios");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });

router.post("/create", ChatRoomController.createRoom);
router.get("/list", ChatRoomController.listRooms);
router.get("/:chat_id/messages", ChatRoomController.getRoomMessages);
// Sử dụng gateway để gửi message (question)
router.post("/message/send", async (req, res) => {
  const start = Date.now();
  console.log(
    `[SEND QUESTION] Bắt đầu gửi question cho userId=${req.body.account_id}, chat_id=${req.body.chat_id}...`
  );
  try {
    const userId = req.body.account_id;
    const response = await axios.post(
      `https://aichatbotlaw.onrender.com/api/Question?userId=${userId}`,
      req.body,
      { headers: req.headers }
    );
    const duration = Date.now() - start;
    console.log(
      `[SEND QUESTION] Thành công cho userId=${userId}, chat_id=${req.body.chat_id}, thời gian xử lý: ${duration}ms`
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    const duration = Date.now() - start;
    console.log(
      `[SEND QUESTION] Lỗi cho userId=${req.body.account_id}, chat_id=${req.body.chat_id}, thời gian xử lý: ${duration}ms, lỗi: ${err.message}`
    );
    res
      .status(err.response?.status || 500)
      .json({ message: err.message, data: err.response?.data });
  }
});

module.exports = router;
