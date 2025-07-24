const LegalDocument = require("../models/LegalDocument");
const ChatRoom = require("../models/ChatRoom");
const Question = require("../models/Question");
const Answer = require("../models/Answer");
const LegalClause = require("../models/LegalClause");
const axios = require("axios");

// Configuration
const CONFIG = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_API_URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
  MAX_CLAUSES_LIMIT: 15,
  AI_TIMEOUT: 8000,
  CLAUSE_PREVIEW_LENGTH: 250,
  MAX_RETRY_ATTEMPTS: 2,
  CACHE_TTL: 300000, // 5 minutes
};

// Enhanced cache system
const cache = new Map();
const setCacheWithTTL = (key, value, ttl = CONFIG.CACHE_TTL) => {
  cache.set(key, { value, expiry: Date.now() + ttl });
};

const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }
  cache.delete(key);
  return null;
};

// Enhanced stopwords with more comprehensive list
const STOPWORDS = new Set([
  "tôi",
  "muốn",
  "biết",
  "về",
  "của",
  "là",
  "cái",
  "gì",
  "xin",
  "cho",
  "hỏi",
  "được",
  "cần",
  "như",
  "thế",
  "nào",
  "ai",
  "ở",
  "khi",
  "nào",
  "bao",
  "nhiêu",
  "vì",
  "sao",
  "có",
  "không",
  "phải",
  "hay",
  "và",
  "hoặc",
  "với",
  "trong",
  "ra",
  "đến",
  "tới",
  "để",
  "bằng",
  "theo",
  "nên",
  "nếu",
  "thì",
  "mà",
  "nhưng",
  "cũng",
  "đã",
  "đang",
  "sẽ",
  "vẫn",
  "chỉ",
  "rất",
  "hơn",
  "ít",
  "nhiều",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
  "mười",
  "từ",
  "cho",
  "đây",
  "đó",
  "này",
  "kia",
  "đâu",
  "cuộc",
  "việc",
  "lần",
  "ngày",
]);

// Enhanced legal phrase patterns - bao gồm pattern cho điều luật cụ thể
const LEGAL_PATTERNS = [
  // Pattern mới cho "Điều X. Tiêu đề" - trích xuất cả số điều và tiêu đề
  /điều\s+(\d+|[IVX]+)\.\s*([^.]+)/i,
  // Pattern cho "Điều X" đơn thuần
  /điều\s+(\d+|[IVX]+)(?!\.\s*[^.]+)/i,
  // Các pattern cũ
  /(luật|bộ luật)\s+([a-zA-ZÀ-ỹ\s]+)(\s+số\s+\d+\/\d+)?/i,
  /(nghị định|quy định)\s+số\s+\d+\/\d+/i,
  /(thông tư|quyết định)\s+số\s+\d+\/\d+/i,
  /(pháp luật|văn bản)\s+([a-zA-ZÀ-ỹ\s]+)/i,
  /khoản\s+\d+/i,
  /chương\s+[IVX]+/i,
];

const QUESTION_TYPES = {
  DEFINITION: /^(định nghĩa|khái niệm|là gì|nghĩa là)/i,
  PROCEDURE: /^(thủ tục|quy trình|cách thức|làm thế nào)/i,
  PENALTY: /^(xử phạt|vi phạm|phạt|hình phạt)/i,
  RIGHTS: /^(quyền|quyền lợi|được phép)/i,
  OBLIGATIONS: /^(nghĩa vụ|phải|bắt buộc)/i,
  CONDITIONS: /^(điều kiện|yêu cầu|tiêu chuẩn)/i,
};

// Utility functions
const generateChatId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const removeVietnameseTones = (str) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

// Hàm trích xuất thông tin từ câu hỏi về điều luật
const extractClauseInfo = (text) => {
  // Pattern để match "Điều X. Tiêu đề"
  const clauseWithTitlePattern = /điều\s+(\d+|[IVX]+)\.\s*([^.]+)/i;
  // Pattern để match "Điều X" không có tiêu đề
  const clauseOnlyPattern = /điều\s+(\d+|[IVX]+)(?!\.\s*[^.]+)/i;

  const clauseWithTitleMatch = text.match(clauseWithTitlePattern);
  if (clauseWithTitleMatch) {
    const clauseNumber = clauseWithTitleMatch[1];
    const clauseTitle = clauseWithTitleMatch[2].trim();

    return {
      type: "CLAUSE_WITH_TITLE",
      clauseNumber,
      clauseTitle,
      fullPhrase: clauseWithTitleMatch[0],
      searchTerms: [
        `điều ${clauseNumber}`,
        clauseTitle,
        `điều ${clauseNumber} ${clauseTitle}`,
        clauseWithTitleMatch[0],
      ],
      priority: "VERY_HIGH",
    };
  }

  const clauseOnlyMatch = text.match(clauseOnlyPattern);
  if (clauseOnlyMatch) {
    const clauseNumber = clauseOnlyMatch[1];

    return {
      type: "CLAUSE_ONLY",
      clauseNumber,
      fullPhrase: clauseOnlyMatch[0],
      searchTerms: [`điều ${clauseNumber}`, clauseNumber],
      priority: "HIGH",
    };
  }

  return null;
};

const extractLegalPhrases = (text) => {
  const phrases = [];
  for (const pattern of LEGAL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      phrases.push(matches[0].trim());
    }
  }
  return phrases;
};

const detectQuestionType = (text) => {
  for (const [type, pattern] of Object.entries(QUESTION_TYPES)) {
    if (pattern.test(text.trim())) {
      return type;
    }
  }
  return "GENERAL";
};

const removeStopwords = (text) => {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => !STOPWORDS.has(word) && word.length > 1)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

// Enhanced keyword extraction with scoring
const extractKeywords = (text) => {
  const originalText = text.trim();
  const lowerText = originalText.toLowerCase();

  // Kiểm tra xem có phải câu hỏi về điều luật cụ thể không
  const clauseInfo = extractClauseInfo(originalText);

  if (clauseInfo) {
    console.log("🎯 Detected specific clause query:", clauseInfo);

    const questionType = detectQuestionType(originalText);

    return {
      fullPhrases: [clauseInfo.fullPhrase],
      mainKeywords: clauseInfo.searchTerms,
      searchTerms: clauseInfo.searchTerms,
      questionType,
      priority: clauseInfo.priority,
      clauseInfo, // Thêm thông tin chi tiết về điều luật
      searchStrategy: "CLAUSE_SPECIFIC", // Đánh dấu chiến lược tìm kiếm
    };
  }
  const legalPhrases = extractLegalPhrases(originalText);
  const questionType = detectQuestionType(originalText);
  if (legalPhrases.length > 0) {
    const mainKeywords = legalPhrases.map((phrase) =>
      phrase
        .replace(/(luật|bộ luật|nghị định|quy định|pháp luật|văn bản)\s*/i, "")
        .trim()
    );

    return {
      fullPhrases: legalPhrases,
      mainKeywords: mainKeywords.filter((k) => k.length > 0),
      searchTerms: [...legalPhrases, ...mainKeywords].filter(
        (term) => term.length > 0
      ),
      questionType,
      priority: "HIGH",
      searchStrategy: "LEGAL_DOCUMENT",
    };
  }
  const withoutStopwords = removeStopwords(originalText);
  const keywords = withoutStopwords
    .split(/\s+/)
    .filter((word) => word.length > 2);

  return {
    fullPhrases: [withoutStopwords],
    mainKeywords: keywords,
    searchTerms: keywords.length > 0 ? keywords : [originalText],
    questionType,
    priority: "MEDIUM",
    searchStrategy: "GENERAL",
  };
};

// AI prompt focused on general legal knowledge only (not specific clauses)
const createAIPrompt = (question, questionType) => {
  const typeSpecificInstructions = {
    DEFINITION: "Định nghĩa rõ ràng và chính xác khái niệm được hỏi.",
    PROCEDURE: "Mô tả tổng quan các bước thực hiện theo thông lệ pháp luật.",
    PENALTY: "Giải thích khái quát về các hình thức xử phạt thường áp dụng.",
    RIGHTS: "Nêu tổng quan về các quyền và quyền lợi liên quan.",
    OBLIGATIONS: "Giải thích về các nghĩa vụ và trách nhiệm chung.",
    CONDITIONS: "Mô tả khái quát các điều kiện và yêu cầu thông thường.",
    GENERAL: "Giải thích tổng quan về vấn đề pháp lý được đặt ra.",
  };

  return `Bạn là chuyên gia pháp lý với kiến thức tổng quát về pháp luật Việt Nam.

Câu hỏi: "${question}"
Loại câu hỏi: ${questionType}

Yêu cầu trả lời:
- ${typeSpecificInstructions[questionType]}
- Trả lời ngắn gọn 1-2 câu dựa trên kiến thức pháp lý tổng quát
- KHÔNG trích dẫn điều khoản cụ thể, chỉ giải thích khái niệm
- Sử dụng ngôn ngữ dễ hiểu, không quá chuyên môn
- Kết thúc bằng: "Các điều khoản pháp lý cụ thể được liệt kê bên dưới."`;
};

// Enhanced API call with retry mechanism
const callGeminiAPI = async (prompt, retryCount = 0) => {
  const cacheKey = `ai_${Buffer.from(prompt).toString("base64").slice(0, 50)}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.post(
      CONFIG.GEMINI_API_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1024,
        },
      },
      {
        timeout: CONFIG.AI_TIMEOUT,
        headers: { "Content-Type": "application/json" },
      }
    );

    const result =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Tôi không thể trả lời câu hỏi này. Vui lòng tham khảo các điều khoản bên dưới.";

    setCacheWithTTL(cacheKey, result);
    return result;
  } catch (error) {
    console.error(
      `Gemini API Error (attempt ${retryCount + 1}):`,
      error.message
    );

    if (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (retryCount + 1))
      );
      return callGeminiAPI(prompt, retryCount + 1);
    }

    return "Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi. Vui lòng tham khảo các điều khoản liên quan bên dưới.";
  }
};

// Enhanced database search với xử lý đặc biệt cho điều luật
const searchClausesFromDB = async (keywordData) => {
  const cacheKey = `clauses_${keywordData.searchTerms.join("_")}_${
    keywordData.searchStrategy
  }`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const { searchTerms, priority, clauseInfo, searchStrategy } = keywordData;
    console.log(
      "🔍 Searching clauses with strategy:",
      searchStrategy,
      "Keywords:",
      searchTerms
    );

    let allClauses = [];

    // Xử lý đặc biệt cho tìm kiếm điều luật cụ thể
    if (searchStrategy === "CLAUSE_SPECIFIC" && clauseInfo) {
      console.log("🎯 Using clause-specific search strategy");

      // Tìm kiếm chính xác theo số điều
      const exactClauseQueries = [
        { clause_number: clauseInfo.clauseNumber },
        { clause_number: `${clauseInfo.clauseNumber}` },
        // Tìm kiếm trong nội dung với pattern chính xác
        {
          clause_content: {
            $regex: `điều\\s+${clauseInfo.clauseNumber}\\b`,
            $options: "i",
          },
        },
      ];

      // Nếu có tiêu đề điều, tìm kiếm theo tiêu đề
      if (clauseInfo.type === "CLAUSE_WITH_TITLE") {
        exactClauseQueries.push(
          { clause_title: { $regex: clauseInfo.clauseTitle, $options: "i" } },
          { clause_content: { $regex: clauseInfo.clauseTitle, $options: "i" } }
        );
      }

      const exactClauses = await LegalClause.find({ $or: exactClauseQueries })
        .select("clause_number clause_content clause_title document_id")
        .lean();

      console.log("📋 Found exact clause matches:", exactClauses.length);
      allClauses = exactClauses;

      // Nếu không tìm thấy kết quả chính xác, mở rộng tìm kiếm
      if (exactClauses.length === 0) {
        console.log("🔍 Expanding search for clause");
        const expandedQueries = searchTerms.flatMap((term) => [
          { clause_content: { $regex: term, $options: "i" } },
          { clause_title: { $regex: term, $options: "i" } },
          {
            clause_content: {
              $regex: removeVietnameseTones(term),
              $options: "i",
            },
          },
        ]);

        const expandedClauses = await LegalClause.find({ $or: expandedQueries })
          .select("clause_number clause_content clause_title document_id")
          .limit(10)
          .lean();

        allClauses = expandedClauses;
      }
    } else {
      // Logic tìm kiếm cũ cho các trường hợp khác
      const clauseQueries = searchTerms.flatMap((term) => {
        const tonelessTerm = removeVietnameseTones(term);
        return [
          { clause_content: { $regex: `\\b${term}\\b`, $options: "i" } },
          { clause_number: { $regex: `^${term}$`, $options: "i" } },
          { clause_content: { $regex: term, $options: "i" } },
          { clause_content: { $regex: tonelessTerm, $options: "i" } },
          { clause_title: { $regex: term, $options: "i" } },
        ];
      });

      const clauseAggregation = [
        { $match: { $or: clauseQueries } },
        {
          $addFields: {
            relevanceScore: {
              $sum: [
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: "$clause_number",
                        regex: searchTerms[0],
                        options: "i",
                      },
                    },
                    10,
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: "$clause_title",
                        regex: searchTerms[0],
                        options: "i",
                      },
                    },
                    5,
                    0,
                  ],
                },
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: "$clause_content",
                        regex: searchTerms[0],
                        options: "i",
                      },
                    },
                    2,
                    0,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { relevanceScore: -1, clause_number: 1 } },
        {
          $limit:
            priority === "HIGH" || priority === "VERY_HIGH"
              ? CONFIG.MAX_CLAUSES_LIMIT
              : Math.floor(CONFIG.MAX_CLAUSES_LIMIT * 0.7),
        },
      ];

      allClauses = await LegalClause.aggregate(clauseAggregation);
    }

    // Remove duplicates và apply final limit
    const uniqueClauses = allClauses
      .filter(
        (clause, index, self) =>
          index ===
          self.findIndex((c) => c._id?.toString() === clause._id?.toString())
      )
      .slice(0, CONFIG.MAX_CLAUSES_LIMIT);

    console.log("📋 Final unique clauses found:", uniqueClauses.length);

    setCacheWithTTL(cacheKey, uniqueClauses, 180000);
    return uniqueClauses;
  } catch (error) {
    console.error("Database search error:", error);
    return [];
  }
};

// Test cases để kiểm tra
const testCases = [
  "tôi muốn biết về Điều 1. Phạm vi điều chỉnh",
  "Điều 5. Quyền và nghĩa vụ",
  "Điều 10",
  "luật doanh nghiệp",
  "quyền của người lao động",
];

console.log("=== TESTING KEYWORD EXTRACTION ===");
testCases.forEach((testCase) => {
  console.log(`\nInput: "${testCase}"`);
  const result = extractKeywords(testCase);
  console.log("Result:", JSON.stringify(result, null, 2));
});
// Optimized document name retrieval with caching
const getDocumentNames = async (documentIds) => {
  const uniqueDocIds = [...new Set(documentIds.map((id) => id.toString()))];
  const cacheKey = `docs_${uniqueDocIds.join("_")}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const documents = await LegalDocument.find({
      _id: { $in: uniqueDocIds },
    })
      .select("_id document_name")
      .lean();

    const docMap = {};
    documents.forEach((doc) => {
      docMap[doc._id.toString()] = doc.document_name;
    });

    setCacheWithTTL(cacheKey, docMap);
    return docMap;
  } catch (error) {
    console.error("Error getting document names:", error);
    return {};
  }
};

// Room management functions (optimized)
exports.createRoom = async (req, res) => {
  try {
    const { account_id, room_name } = req.body;

    if (!account_id || !room_name) {
      return res
        .status(400)
        .json({ error: "Account ID and room name are required" });
    }

    const chat_id = generateChatId();
    const room = await ChatRoom.create({ chat_id, account_id, room_name });

    res.status(201).json({
      success: true,
      data: { chat_id, room },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listRooms = async (req, res) => {
  try {
    const { account_id } = req.query;

    if (!account_id) {
      return res.status(400).json({ error: "Account ID is required" });
    }

    const rooms = await ChatRoom.find({ account_id })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ success: true, data: rooms });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRoomMessages = async (req, res) => {
  try {
    const { chat_id } = req.params;

    // Use aggregation for better performance
    const chatHistory = await Question.aggregate([
      { $match: { chat_id } },
      { $sort: { question_date: 1 } },
      {
        $lookup: {
          from: "answers",
          localField: "_id",
          foreignField: "question_id",
          as: "answer",
        },
      },
      {
        $project: {
          question: "$question_content",
          answer: { $arrayElemAt: ["$answer.answer_content", 0] },
          question_date: 1,
          answer_date: { $arrayElemAt: ["$answer.answer_date", 0] },
          chat_id: 1,
        },
      },
    ]);

    res.json({ success: true, data: chatHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Enhanced main message handler
exports.sendMessage = async (req, res) => {
  const startTime = Date.now();

  try {
    const { question_content, account_id, chat_id } = req.body;

    // Validation
    if (!question_content?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Question content is required",
      });
    }

    if (!account_id) {
      return res.status(400).json({
        success: false,
        error: "Account ID is required",
      });
    }

    const chatId = chat_id || generateChatId();
    const trimmedQuestion = question_content.trim();

    console.log("❓ Processing question:", trimmedQuestion);

    // Parallel execution for better performance
    const [question, keywordData] = await Promise.all([
      Question.create({
        question_content: trimmedQuestion,
        account_id,
        chat_id: chatId,
      }),
      Promise.resolve(extractKeywords(trimmedQuestion)),
    ]);

    console.log("🔑 Extracted keywords:", keywordData);

    // Parallel AI call and database search
    const [ai_answer, clauses] = await Promise.all([
      callGeminiAPI(createAIPrompt(trimmedQuestion, keywordData.questionType)),
      searchClausesFromDB(keywordData),
    ]);

    console.log("🤖 AI Answer (general knowledge):", ai_answer);
    console.log("📋 Found clauses from DB:", clauses.length);

    // Get document names for found clauses
    const documentIds = clauses
      .map((clause) => clause.document_id)
      .filter(Boolean);
    const documentNames =
      documentIds.length > 0 ? await getDocumentNames(documentIds) : {};

    // Enhanced clause formatting
    const formattedClauses = clauses.map((clause, idx) => {
      const content = clause.clause_content || "";
      const truncatedContent =
        content.length > CONFIG.CLAUSE_PREVIEW_LENGTH
          ? content.slice(0, CONFIG.CLAUSE_PREVIEW_LENGTH) + "..."
          : content;

      return {
        stt: idx + 1,
        dieu: clause.clause_number
          ? `Điều ${clause.clause_number}`
          : `Mục ${idx + 1}`,
        tieu_de: clause.clause_title || "",
        noi_dung: truncatedContent,
        van_ban:
          documentNames[clause.document_id?.toString()] || "Không xác định",
        document_id: clause.document_id,
        id: clause._id,
        relevance_score: clause.relevanceScore || 0,
      };
    });

    // Create final answer: AI general response + specific legal clauses from DB
    let final_answer = `**💡 Giải đáp:**\n${ai_answer}`;

    if (clauses.length > 0) {
      final_answer += "\n\n**📋 Điều khoản pháp lý liên quan:**\n";
      formattedClauses.forEach((clause, index) => {
        const title = clause.tieu_de ? ` - ${clause.tieu_de}` : "";
        final_answer += `\n**${clause.dieu}${title}** (${clause.van_ban}):\n${clause.noi_dung}\n`;

        if (index < formattedClauses.length - 1) {
          final_answer += "\n---\n";
        }
      });

      final_answer +=
        "\n💡 *Lưu ý: Vui lòng tham khảo toàn văn các điều khoản để có thông tin đầy đủ và chính xác nhất.*";
    } else {
      final_answer +=
        "\n\n❌ **Không tìm thấy điều khoản cụ thể trong hệ thống.**\nKhuyến nghị liên hệ chuyên gia pháp lý để được tư vấn chi tiết về các văn bản pháp luật liên quan.";
    }

    // Save answer
    const answer = await Answer.create({
      answer_content: final_answer,
      question_id: question._id,
      chat_id: chatId,
    });

    const processingTime = Date.now() - startTime;

    // Enhanced response
    res.status(201).json({
      success: true,
      data: {
        question: {
          id: question._id,
          content: question.question_content,
          date: question.question_date,
        },
        answer: {
          id: answer._id,
          ai_general_response: ai_answer, // Câu trả lời tổng quát từ Gemini
          full_content: final_answer, // AI answer + điều khoản từ DB
          date: answer.answer_date,
        },
        related_clauses: formattedClauses, // Điều khoản cụ thể từ database
        chat_id: chatId,
        metadata: {
          question_type: keywordData.questionType,
          keywords_used: keywordData.mainKeywords.join(", "),
          search_terms: keywordData.searchTerms,
          clauses_found: clauses.length,
          documents_involved: Object.values(documentNames).filter(Boolean),
          processing_time_ms: processingTime,
          cache_hits: cache.size,
          search_priority: keywordData.priority,
          response_structure: "ai_general_knowledge + db_specific_clauses",
        },
      },
    });

    console.log(`✅ Response sent successfully in ${processingTime}ms`);
  } catch (error) {
    console.error("SendMessage Error:", error);

    const errorResponse = {
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    };

    if (error.name === "ValidationError") {
      errorResponse.error = "Invalid input data";
      errorResponse.details = error.message;
      return res.status(400).json(errorResponse);
    }

    if (error.code === 11000) {
      errorResponse.error = "Duplicate entry";
      return res.status(409).json(errorResponse);
    }

    if (process.env.NODE_ENV === "development") {
      errorResponse.debug = {
        message: error.message,
        stack: error.stack,
        processing_time: Date.now() - (req.startTime || Date.now()),
      };
    }

    res.status(500).json(errorResponse);
  }
};

// Cleanup function for cache (optional - can be called periodically)
exports.clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expiry <= now) {
      cache.delete(key);
    }
  }
  console.log(`🧹 Cache cleanup completed. Active entries: ${cache.size}`);
};

module.exports = exports;
