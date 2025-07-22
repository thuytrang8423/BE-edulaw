const mongoose = require('mongoose');
const ChatRoomSchema = new mongoose.Schema({
  chat_id: { type: String, required: true, unique: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room_name: { type: String, required: false },
}, { timestamps: true });
module.exports = mongoose.model('ChatRoom', ChatRoomSchema); 