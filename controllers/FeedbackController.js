const Feedback = require("../models/Feedback");

exports.create = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const feedback = await Feedback.create({
      user_id: user.id,
      content: req.body.content,
    });
    res.status(201).json({
      name: user.name,
      content: feedback.content,
      createdAt: feedback.createdAt,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  const feedbacks = await Feedback.find()
    .sort({ createdAt: -1 })
    .populate("user_id", "name");
  const result = feedbacks.map((fb) => ({
    name: fb.user_id && fb.user_id.name ? fb.user_id.name : "",
    content: fb.content,
    createdAt: fb.createdAt,
  }));
  res.json(result);
};

exports.update = async (req, res) => {
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!feedback) return res.status(404).json({ error: "Not found" });
  res.json(feedback);
};

exports.delete = async (req, res) => {
  const feedback = await Feedback.findByIdAndDelete(req.params.id);
  if (!feedback) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
};
