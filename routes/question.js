const express = require("express");
const router = express.Router();
const controller = require("../controllers/QuestionController");

router.post("/", controller.create);
router.get('/chat-sessions', controller.getChatSessions);
router.get('/chat-history', controller.getChatHistory);
router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.put("/:id", controller.update);
router.delete("/:id", controller.delete);


module.exports = router;
