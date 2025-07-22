const Feedback = require('../models/Feedback');

exports.create = async (req, res) => {
  try {
    const feedback = await Feedback.create(req.body);
    res.status(201).json(feedback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  const feedbacks = await Feedback.find().sort({ createdAt: -1 });
  res.json(feedbacks);
};

exports.update = async (req, res) => {
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!feedback) return res.status(404).json({ error: 'Not found' });
  res.json(feedback);
};

exports.delete = async (req, res) => {
  const feedback = await Feedback.findByIdAndDelete(req.params.id);
  if (!feedback) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}; 