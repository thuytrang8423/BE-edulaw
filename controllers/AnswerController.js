const Answer = require("../models/Answer");

exports.create = async (req, res) => {
  try {
    const answer = await Answer.create(req.body);
    res.status(201).json(answer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { questionId, userId } = req.query;
    let filter = {};
    if (questionId) filter.question_id = questionId;
    if (userId) {
      // Lấy các question có account_id = userId
      const Question = require("../models/Question");
      const questions = await Question.find({ account_id: userId });
      const questionIds = questions.map((q) => q._id.toString());
      if (questionIds.length > 0) {
        filter.question_id = filter.question_id
          ? filter.question_id
          : { $in: questionIds };
      } else {
        // Không có question nào của user này
        return res.json([]);
      }
    }
    const answers = await Answer.find(filter);
    res.json(answers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req, res) => {
  const answer = await Answer.findById(req.params.id);
  if (!answer) return res.status(404).json({ error: "Not found" });
  res.json(answer);
};

exports.update = async (req, res) => {
  const answer = await Answer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!answer) return res.status(404).json({ error: "Not found" });
  res.json(answer);
};

exports.delete = async (req, res) => {
  const answer = await Answer.findByIdAndDelete(req.params.id);
  if (!answer) return res.status(404).json({ error: "Not found" });
  res.json({ message: "Deleted" });
};
