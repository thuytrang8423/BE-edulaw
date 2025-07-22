const LegalDocument = require('../models/LegalDocument');

exports.create = async (req, res) => {
  try {
    const legalDocument = await LegalDocument.create(req.body);
    res.status(201).json(legalDocument);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  const legalDocuments = await LegalDocument.find();
  res.json(legalDocuments);
};

exports.getById = async (req, res) => {
  const legalDocument = await LegalDocument.findById(req.params.id);
  if (!legalDocument) return res.status(404).json({ error: 'Not found' });
  res.json(legalDocument);
};

exports.update = async (req, res) => {
  const legalDocument = await LegalDocument.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!legalDocument) return res.status(404).json({ error: 'Not found' });
  res.json(legalDocument);
};

exports.delete = async (req, res) => {
  const legalDocument = await LegalDocument.findByIdAndDelete(req.params.id);
  if (!legalDocument) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}; 