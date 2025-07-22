const mongoose = require("mongoose");
const LegalDocumentSchema = new mongoose.Schema({
  document_id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  document_name: { type: String, required: true },
  document_type: { type: String, required: true },
  document_date_issue: { type: Date, required: true },
  document_signee: { type: String },
});
module.exports = mongoose.model("LegalDocument", LegalDocumentSchema);
