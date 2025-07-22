const mongoose = require('mongoose');
const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});
module.exports = mongoose.model('Notification', NotificationSchema); 