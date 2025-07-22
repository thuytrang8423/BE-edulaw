const Question = require("../models/Question");

exports.create = async (req, res) => {
  try {
    const question = await Question.create(req.body);
    res.status(201).json(question);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  const questions = await Question.find();
  res.json(questions);
};

exports.getById = async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (!question) return res.status(404).json({ error: "Not found" });
  res.json(question);
};

exports.update = async (req, res) => {
  const question = await Question.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!question) return res.status(404).json({ error: "Not found" });
  res.json(question);
};

exports.delete = async (req, res) => {
  const question = await Question.findByIdAndDelete(req.params.id);
  if (!question) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
};

