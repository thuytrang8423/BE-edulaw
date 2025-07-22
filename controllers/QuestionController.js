const Question = require("../models/Question");
const LegalClause = require("../models/LegalClause");
const Answer = require("../models/Answer");
const axios = require("axios");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LegalDocument = require("../models/LegalDocument"); // Added this import

exports.create = async (req, res) => {
  try {
    const { question_content, account_id, chat_id } = req.body;
    const chatId = chat_id || (Date.now() + '-' + Math.random().toString(36).slice(2, 10));
    // 1. Lưu question
    const question = await Question.create({ question_content, account_id, chat_id: chatId });

    // 2. Tìm clause liên quan (ưu tiên theo tên văn bản luật)
    const keyword = question_content.trim();
    // Tìm các văn bản luật có tên liên quan
    const lawDocs = await LegalDocument.find({ document_name: { $regex: keyword, $options: 'i' } });
    let docIds = lawDocs.map(doc => doc._id);
    let clauseFilter = [];
    if (docIds.length > 0) {
      clauseFilter.push({ document_id: { $in: docIds } });
    }
    // Tìm điều khoản có nội dung hoặc số điều khoản chứa từ khóa chính xác (word boundary)
    clauseFilter.push(
      { clause_content: { $regex: `\\b${keyword}\\b`, $options: 'i' } },
      { clause_number: { $regex: keyword, $options: 'i' } }
    );
    const clauses = await LegalClause.find({ $or: clauseFilter }).limit(10);

    if (!clauses.length) {
      // Prompt cực kỳ chặt chẽ, không cho AI tự ý trả lời
      const prompt = `Bạn là trợ lý pháp lý. Hiện tại không có điều khoản nào phù hợp trong hệ thống.\nYêu cầu: KHÔNG được tự ý trả lời, KHÔNG được bịa thông tin, KHÔNG được giải thích thêm.\nChỉ trả lời đúng một câu: \"Tôi không tìm thấy điều khoản phù hợp trong hệ thống.\"`;
      let answer_content = '';
      try {
        const geminiRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ]
          }
        );
        answer_content = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Tôi không tìm thấy điều khoản phù hợp trong hệ thống.";
      } catch (aiErr) {
        answer_content = "Tôi không tìm thấy điều khoản phù hợp trong hệ thống.";
      }
      const answer = await Answer.create({
        answer_content,
        question_id: question._id,
        chat_id: chatId
      });
      return res.status(201).json({ question, answer, clauses: [], chat_id: chatId });
    }

    // 3. Tạo prompt tối ưu cho Gemini
    const clauseText = clauses.map((c, idx) =>
      `(${idx+1}) Điều ${c.clause_number} [${c.document_id}]: ${c.clause_content}`
    ).join('\n');

    const prompt = `Bạn là trợ lý pháp lý.\nDưới đây là các điều khoản liên quan từ cơ sở dữ liệu:\n${clauseText}\n\nCâu hỏi của người dùng: \"${question_content}\"\n\nYêu cầu:\n- Chỉ trả lời dựa trên các điều khoản trên, không thêm thông tin ngoài.\n- Trả lời đầy đủ, đúng trọng tâm, không trả lời thừa, không bịa.\n- Nếu có nhiều điều khoản, hãy tổng hợp và chọn điều khoản phù hợp nhất.\n- Trích dẫn số điều khoản và tên văn bản nếu có.\n- Nếu không có điều khoản phù hợp, chỉ trả lời: \"Tôi không tìm thấy điều khoản phù hợp trong hệ thống.\"`;

    // 4. Gọi Gemini API
    let answer_content = '';
    try {
      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        }
      );
      answer_content = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Tôi không hiểu bạn đang hỏi gì.";
    } catch (aiErr) {
      answer_content = "Tôi không hiểu bạn đang hỏi gì.";
    }

    // 5. Lưu answer vào DB (kèm chat_id)
    const answer = await Answer.create({
      answer_content,
      question_id: question._id,
      chat_id: chatId
    });

    res.status(201).json({ question, answer, clauses, chat_id: chatId });
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

exports.getChatHistory = async (req, res) => {
  try {
    const { user_id, chat_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    const filter = { account_id: user_id };
    if (chat_id) filter.chat_id = chat_id;
    // Lấy tất cả question của user (và chat_id nếu có), sort theo thời gian
    const questions = await Question.find(filter).sort({ question_date: 1 });
    // Lấy answer cho từng question
    const chatHistory = await Promise.all(
      questions.map(async (q) => {
        const answer = await Answer.findOne({ question_id: q._id });
        return {
          question: q.question_content,
          answer: answer ? answer.answer_content : null,
          question_date: q.question_date,
          answer_date: answer ? answer.answer_date : null,
          chat_id: q.chat_id
        };
      })
    );
    res.json(chatHistory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy danh sách các phòng chat (session) của user
exports.getChatSessions = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    // Lấy tất cả chat_id của user, group by chat_id, sort theo thời gian mới nhất
    const sessions = await Question.aggregate([
      { $match: { account_id: typeof user_id === 'string' ? (user_id.length === 24 ? new (require('mongoose').Types.ObjectId)(user_id) : user_id) : user_id } },
      { $group: {
          _id: "$chat_id",
          last_question_date: { $max: "$question_date" },
          first_question: { $first: "$question_content" }
        }
      },
      { $sort: { last_question_date: -1 } }
    ]);
    const result = sessions.map(s => ({
      chat_id: s._id,
      last_question_date: s.last_question_date,
      first_question: s.first_question
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

