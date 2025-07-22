const LegalDocument = require("../models/LegalDocument"); // Added this import
const ChatRoom = require("../models/ChatRoom");
const Question = require("../models/Question");
const Answer = require("../models/Answer");
const LegalClause = require("../models/LegalClause");
const axios = require("axios");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

exports.createRoom = async (req, res) => {
  try {
    const { account_id, room_name } = req.body;
    const chat_id = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    const room = await ChatRoom.create({ chat_id, account_id, room_name });
    res.status(201).json({ chat_id, room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listRooms = async (req, res) => {
  try {
    const { account_id } = req.query;
    const rooms = await ChatRoom.find({ account_id });
    res.json(rooms);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRoomMessages = async (req, res) => {
  try {
    const { chat_id } = req.params;
    const questions = await Question.find({ chat_id }).sort({
      question_date: 1,
    });
    const chatHistory = await Promise.all(
      questions.map(async (q) => {
        const answer = await Answer.findOne({ question_id: q._id });
        return {
          question: q.question_content,
          answer: answer ? answer.answer_content : null,
          question_date: q.question_date,
          answer_date: answer ? answer.answer_date : null,
          chat_id: q.chat_id,
        };
      })
    );
    res.json(chatHistory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Constants
const STOPWORDS = new Set([
    "tôi", "muốn", "biết", "về", "của", "là", "cái", "gì", "xin", "cho", "hỏi", 
    "được", "cần", "như", "thế", "nào", "ai", "ở", "khi", "nào", "bao", "nhiêu", 
    "vì", "sao", "có", "không", "phải", "hay", "và", "hoặc", "với", "trong", 
    "ra", "đến", "tới", "để", "bằng", "theo", "nên", "nếu", "thì", "mà", "nhưng", 
    "cũng", "đã", "đang", "sẽ", "vẫn", "chỉ", "rất", "hơn", "ít", "nhiều", 
    "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười"
  ]);
  
  const LEGAL_PHRASE_REGEX = /(luật|bộ luật|nghị định|quy định|pháp luật|văn bản) [a-zA-ZÀ-ỹ0-9\s]+/i;
  const DEFAULT_NO_RESULT_MESSAGE = "Tôi không tìm thấy điều khoản phù hợp trong hệ thống.";
  const DEFAULT_ERROR_MESSAGE = "Xin lỗi, đã có lỗi xảy ra khi xử lý câu hỏi của bạn.";
  const MAX_CLAUSES_LIMIT = 10;
  
  // Utility functions
  const generateChatId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  
  const extractLegalPhrase = (text) => {
    const match = text.toLowerCase().match(LEGAL_PHRASE_REGEX);
    return match ? match[0].trim() : null;
  };
  
  const removeStopwords = (text) => {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => !STOPWORDS.has(word))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  };
  
  const extractKeywords = (text) => {
    const legalPhrase = extractLegalPhrase(text);
    if (legalPhrase) {
      // Nếu có cụm pháp lý, trả về cả cụm đầy đủ và từ khóa chính
      const mainKeyword = legalPhrase.replace(/(luật|bộ luật|nghị định|quy định|pháp luật|văn bản)\s*/i, '').trim();
      return {
        fullPhrase: legalPhrase,
        mainKeyword: mainKeyword,
        searchTerms: [legalPhrase, mainKeyword].filter(term => term.length > 0)
      };
    }
    
    const withoutStopwords = removeStopwords(text);
    const finalKeyword = withoutStopwords || text.trim();
    
    return {
      fullPhrase: finalKeyword,
      mainKeyword: finalKeyword,
      searchTerms: [finalKeyword]
    };
  };
  
  const buildClauseSearchFilter = (searchTerms, docIds) => {
    const filters = [];
    
    // Thêm filter theo document_id nếu có
    if (docIds.length > 0) {
      filters.push({ document_id: { $in: docIds } });
    }
    
    // Tạo multiple search patterns cho mỗi search term
    searchTerms.forEach(term => {
      filters.push(
        { clause_content: { $regex: `\\b${term}\\b`, $options: "i" } },
        { clause_content: { $regex: term, $options: "i" } }, // Fallback cho partial match
        { clause_number: { $regex: term, $options: "i" } }
      );
    });
    
    return { $or: filters };
  };
  
  const formatClausesForPrompt = (clauses) => {
    return clauses
      .map((clause, idx) => 
        `(${idx + 1}) Điều ${clause.clause_number} [${clause.document_id}]: ${clause.clause_content}`
      )
      .join("\n");
  };
  
  const createPrompt = (question, clauseText) => {
    if (!clauseText) {
      return `Bạn là trợ lý pháp lý. Hiện tại không có điều khoản nào phù hợp trong hệ thống.
  Yêu cầu: KHÔNG được tự ý trả lời, KHÔNG được bịa thông tin, KHÔNG được giải thích thêm.
  Chỉ trả lời đúng một câu: "${DEFAULT_NO_RESULT_MESSAGE}"`;
    }
  
    return `Bạn là trợ lý pháp lý.
  Dưới đây là các điều khoản liên quan từ cơ sở dữ liệu:
  ${clauseText}
  
  Câu hỏi của người dùng: "${question}"
  
  Yêu cầu:
  - Chỉ trả lời dựa trên các điều khoản trên, không thêm thông tin ngoài.
  - Trả lời đầy đủ, đúng trọng tâm, không trả lời thừa, không bịa.
  - Nếu có nhiều điều khoản, hãy tổng hợp và chọn điều khoản phù hợp nhất.
  - Trích dẫn số điều khoản và tên văn bản nếu có.
  - Nếu không có điều khoản phù hợp, chỉ trả lời: "${DEFAULT_NO_RESULT_MESSAGE}"`;
  };
  
  const callGeminiAPI = async (prompt) => {
    try {
      const response = await axios.post(GEMINI_API_URL, {
        contents: [{ parts: [{ text: prompt }] }]
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || DEFAULT_NO_RESULT_MESSAGE;
    } catch (error) {
      console.error('Gemini API Error:', error.message);
      return DEFAULT_ERROR_MESSAGE;
    }
  };
  
  const findRelevantClauses = async (keywordData) => {
    try {
      const { searchTerms } = keywordData;
      
      // Tìm documents liên quan với tất cả search terms
      const documentQueries = searchTerms.map(term => ({
        document_name: { $regex: term, $options: "i" }
      }));
      
      const [lawDocs, directClauses] = await Promise.all([
        LegalDocument.find({
          $or: documentQueries
        }).select('_id').lean(),
        
        // Tìm clauses trực tiếp với tất cả search terms
        LegalClause.find({
          $or: searchTerms.flatMap(term => [
            { clause_content: { $regex: `\\b${term}\\b`, $options: "i" } },
            { clause_content: { $regex: term, $options: "i" } },
            { clause_number: { $regex: term, $options: "i" } }
          ])
        }).limit(MAX_CLAUSES_LIMIT).lean()
      ]);
  
      // Nếu có documents, tìm thêm clauses từ documents đó
      if (lawDocs.length > 0) {
        const docIds = lawDocs.map(doc => doc._id);
        const filter = buildClauseSearchFilter(searchTerms, docIds);
        
        const additionalClauses = await LegalClause.find(filter)
          .limit(MAX_CLAUSES_LIMIT)
          .lean();
        
        // Merge và deduplicate clauses
        const allClauses = [...directClauses, ...additionalClauses];
        const uniqueClauses = allClauses.filter((clause, index, self) => 
          index === self.findIndex(c => c._id.toString() === clause._id.toString())
        );
        
        return uniqueClauses.slice(0, MAX_CLAUSES_LIMIT);
      }
  
      return directClauses;
    } catch (error) {
      console.error('Database query error:', error);
      return [];
    }
  };
  
  exports.sendMessage = async (req, res) => {
    try {
      // Input validation
      const { question_content, account_id, chat_id } = req.body;
      
      if (!question_content?.trim()) {
        return res.status(400).json({ error: "Question content is required" });
      }
      
      if (!account_id) {
        return res.status(400).json({ error: "Account ID is required" });
      }
  
      const chatId = chat_id || generateChatId();
      const trimmedQuestion = question_content.trim();
  
      // Save question to database
      const question = await Question.create({
        question_content: trimmedQuestion,
        account_id,
        chat_id: chatId,
      });
  
      // Extract keywords and find relevant clauses
      const keywordData = extractKeywords(trimmedQuestion);
      const clauses = await findRelevantClauses(keywordData);
  
      // Generate AI response
      const clauseText = clauses.length > 0 ? formatClausesForPrompt(clauses) : null;
      const prompt = createPrompt(trimmedQuestion, clauseText);
      const answer_content = await callGeminiAPI(prompt);
  
      // Save answer to database
      const answer = await Answer.create({
        answer_content,
        question_id: question._id,
        chat_id: chatId,
      });
  
      res.status(201).json({ 
        success: true,
        data: {
          question, 
          answer, 
          clauses, 
          chat_id: chatId,
          metadata: {
            keyword_used: keywordData.fullPhrase,
            search_terms: keywordData.searchTerms,
            clauses_found: clauses.length
          }
        }
      });
  
    } catch (error) {
      console.error('SendMessage Error:', error);
      
      // Determine error type and respond appropriately
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          success: false,
          error: "Invalid input data",
          details: error.message 
        });
      }
      
      if (error.code === 11000) {
        return res.status(409).json({ 
          success: false,
          error: "Duplicate entry" 
        });
      }
  
      res.status(500).json({ 
        success: false,
        error: "Internal server error",
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  };
  