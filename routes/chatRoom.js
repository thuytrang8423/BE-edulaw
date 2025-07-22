const express = require('express');
const router = express.Router();
const ChatRoomController = require('../controllers/ChatRoomController');

router.post('/create', ChatRoomController.createRoom);
router.get('/list', ChatRoomController.listRooms);
router.get('/:chat_id/messages', ChatRoomController.getRoomMessages);
router.post('/message/send', ChatRoomController.sendMessage);

module.exports = router; 