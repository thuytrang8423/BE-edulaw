const mongoose = require('mongoose');
const QuestionSchema = new mongoose.Schema({
  question_id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  question_content: { type: String, required: true },
  question_date: { type: Date, default: Date.now },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
module.exports = mongoose.model('Question', QuestionSchema); 