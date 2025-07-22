const Answer = require('../models/Answer');

exports.create = async (req, res) => {
  try {
    const answer = await Answer.create(req.body);
    res.status(201).json(answer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  const answers = await Answer.find();
  res.json(answers);
};

exports.getById = async (req, res) => {
  const answer = await Answer.findById(req.params.id);
  if (!answer) return res.status(404).json({ error: 'Not found' });
  res.json(answer);
};

exports.update = async (req, res) => {
  const answer = await Answer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!answer) return res.status(404).json({ error: 'Not found' });
  res.json(answer);
};

exports.delete = async (req, res) => {
  const answer = await Answer.findByIdAndDelete(req.params.id);
  if (!answer) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}; 