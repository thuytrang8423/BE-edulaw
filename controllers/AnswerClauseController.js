const AnswerClause = require('../models/AnswerClause');

exports.create = async (req, res) => {
  try {
    const answerClause = await AnswerClause.create(req.body);
    res.status(201).json(answerClause);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  const answerClauses = await AnswerClause.find();
  res.json(answerClauses);
};

exports.getById = async (req, res) => {
  const answerClause = await AnswerClause.findById(req.params.id);
  if (!answerClause) return res.status(404).json({ error: 'Not found' });
  res.json(answerClause);
};

exports.update = async (req, res) => {
  const answerClause = await AnswerClause.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!answerClause) return res.status(404).json({ error: 'Not found' });
  res.json(answerClause);
};

exports.delete = async (req, res) => {
  const answerClause = await AnswerClause.findByIdAndDelete(req.params.id);
  if (!answerClause) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}; 