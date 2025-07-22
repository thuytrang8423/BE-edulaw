const mongoose = require('mongoose');
const AnswerClauseSchema = new mongoose.Schema({
  answer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true },
  clause_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LegalClause', required: true }
});
module.exports = mongoose.model('AnswerClause', AnswerClauseSchema); 