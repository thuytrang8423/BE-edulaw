const mongoose = require('mongoose');
const AnswerSchema = new mongoose.Schema({
  answer_id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  answer_content: { type: String, required: true },
  answer_date: { type: Date, default: Date.now },
  question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true }
});
module.exports = mongoose.model('Answer', AnswerSchema); 