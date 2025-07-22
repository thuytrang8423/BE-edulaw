const mongoose = require('mongoose');
const LegalClauseSchema = new mongoose.Schema({
  clause_id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  clause_number: { type: String, required: true },
  clause_content: { type: String, required: true },
  embedding: { type: [Number] },
  document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LegalDocument', required: true }
});
module.exports = mongoose.model('LegalClause', LegalClauseSchema); 