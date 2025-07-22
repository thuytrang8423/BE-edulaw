const mongoose = require('mongoose');
const FeedbackSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'handled'], default: 'pending' }
});
module.exports = mongoose.model('Feedback', FeedbackSchema); 