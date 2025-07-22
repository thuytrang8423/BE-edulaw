const LegalClause = require('../models/LegalClause');

exports.create = async (req, res) => {
  try {
    const legalClause = await LegalClause.create(req.body);
    res.status(201).json(legalClause);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET all, có thể filter theo document_id
exports.getAll = async (req, res) => {
  const filter = {};
  if (req.query.document_id) {
    filter.document_id = req.query.document_id;
  }
  const legalClauses = await LegalClause.find(filter);
  res.json(legalClauses);
};

exports.getById = async (req, res) => {
  const legalClause = await LegalClause.findById(req.params.id);
  if (!legalClause) return res.status(404).json({ error: 'Not found' });
  res.json(legalClause);
};

exports.update = async (req, res) => {
  const legalClause = await LegalClause.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!legalClause) return res.status(404).json({ error: 'Not found' });
  res.json(legalClause);
};

exports.delete = async (req, res) => {
  const legalClause = await LegalClause.findByIdAndDelete(req.params.id);
  if (!legalClause) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
};

exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing search keyword' });
    // Tìm kiếm theo nội dung hoặc số điều khoản
    const clauses = await LegalClause.find({
      $or: [
        { clause_content: { $regex: q, $options: 'i' } },
        { clause_number: { $regex: q, $options: 'i' } }
      ]
    });
    res.json(clauses);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}; 