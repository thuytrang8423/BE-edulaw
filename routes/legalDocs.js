const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const LegalDocument = require("../models/LegalDocument");
const LegalClause = require("../models/LegalClause");
const controller = require("../controllers/LegalDocumentController");
const cloudinary = require("../services/cloudinary");

// Cấu hình multer với PDF validation
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Kiểm tra MIME type
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file PDF"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn 10MB
  },
});

// Helper: Tách điều khoản theo kiểu Python main.py (chỉ tách theo "Điều X." hoặc "Điều X:")
function splitIntoClauses(text) {
  // Tách theo "Điều X." hoặc "Điều X:"
  const clauses = text.split(/(?=Điều\s+\d+\s*[\.:])/);
  return clauses
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0)
    .map((clause) => {
      const lines = clause.split(/\r?\n/).filter(Boolean);
      const title = lines[0] || "";
      const content = lines.slice(1).join("\n").trim();
      return { title, content };
    });
}

// Helper: Tách chương theo "Chương X." hoặc "Chương X:"
function splitIntoChapters(text) {
  // Tách theo "Chương X." hoặc "Chương X:"
  const chapters = text.split(/(?=Chương\s+[IVXLCDM0-9]+\s*[\.:])/i);
  return chapters
    .map((chapter) => chapter.trim())
    .filter((chapter) => chapter.length > 0)
    .map((chapter) => {
      const lines = chapter.split(/\r?\n/).filter(Boolean);
      const title = lines[0] || "";
      const content = lines.slice(1).join("\n").trim();
      return { title, content };
    });
}

// Helper: Kiểm tra text có dấu tiếng Việt không
function hasVietnamese(text) {
  // Kiểm tra một số dấu tiếng Việt phổ biến
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text
  );
}

// POST /upload - Upload PDF, trích xuất và lưu vào database với validation đầy đủ
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // 1. Kiểm tra file tồn tại
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // 2. Kiểm tra MIME type (double check)
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        message: "File phải là định dạng PDF",
      });
    }

    // 3. Kiểm tra đuôi file
    if (!req.file.originalname.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({
        success: false,
        message: "File phải có đuôi .pdf",
      });
    }

    // 4. Đọc và validate nội dung PDF
    let data;
    try {
      data = await pdfParse(req.file.buffer);
    } catch (pdfError) {
      return res.status(400).json({
        success: false,
        message: "File PDF bị lỗi hoặc không thể đọc được",
      });
    }

    let text = data.text;

    // Nếu text không có dấu tiếng Việt hoặc quá ngắn, trả về lỗi
    if (!hasVietnamese(text) || text.length < 20) {
      return res.status(400).json({
        success: false,
        message: "File PDF không hợp lệ hoặc quá ngắn.",
      });
    }

    // Tách chương
    const chapters = splitIntoChapters(text);
    const chapterTitles = chapters.map((chap) => chap.title);

    // Sử dụng splitIntoClauses thay cho extractClauses
    const clauses = splitIntoClauses(text);

    if (!clauses.length) {
      return res.status(400).json({
        success: false,
        message: "Không trích xuất được điều khoản nào từ file PDF.",
      });
    }

    // Tạo tên file dựa trên tên file gốc
    const originalName = req.file.originalname.replace(".pdf", "");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

    // 1. Upload PDF lên Cloudinary với validation
    const uploadToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "raw", // Để upload file PDF
            folder: "legal_docs", // Tùy chọn: lưu vào folder riêng
            public_id: `${originalName}-${timestamp}`,
            allowed_formats: ["pdf"], // Chỉ cho phép PDF
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadToCloudinary();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Upload lên Cloudinary thất bại",
        error: err.message,
      });
    }

    // 2. Lưu LegalDocument vào database với URL từ Cloudinary
    const legalDocument = await LegalDocument.create({
      document_name: originalName,
      document_type: "PDF",
      document_date_issue: new Date(),
      document_signee: "System Upload",
      document_url: cloudinaryResult.secure_url, // Lưu URL cloudinary
    });

    // 3. Lưu từng điều khoản vào LegalClause
    const savedClauses = [];
    for (const clause of clauses) {
      // Trích xuất số điều từ title (VD: "Điều 1. Phạm vi điều chỉnh" -> "1")
      const clauseNumberMatch = clause.title.match(/Điều\s+(\d+)/);
      const clauseNumber = clauseNumberMatch ? clauseNumberMatch[1] : "0";

      const savedClause = await LegalClause.create({
        clause_number: clauseNumber,
        clause_content: clause.content,
        document_id: legalDocument._id,
      });

      savedClauses.push({
        id: savedClause._id,
        number: clauseNumber,
        title: clause.title,
        content: clause.content,
      });
    }

    res.json({
      success: true,
      chapterCount: chapters.length,
      chapters: chapterTitles,
      clauseCount: clauses.length,
      document: {
        id: legalDocument._id,
        name: legalDocument.document_name,
        type: legalDocument.document_type,
        date: legalDocument.document_date_issue,
        url: legalDocument.document_url,
      },
      clauses: savedClauses,
      message: `✅ Đã upload, nhận diện ${chapters.length} chương, trích xuất và lưu ${clauses.length} điều khoản vào database.`,
    });

    // Emit socket thông báo upload thành công
    const io = req.app.get("io");
    if (io) {
      io.emit("legal_doc_uploaded", {
        document: {
          id: legalDocument._id,
          name: legalDocument.document_name,
          url: legalDocument.document_url,
          date: legalDocument.document_date_issue,
        },
        message: "Văn bản pháp luật mới đã được upload!",
      });
    }
  } catch (err) {
    console.error("Upload and save to database error:", err);

    // Xử lý lỗi từ multer fileFilter
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File quá lớn. Vui lòng upload file dưới 10MB",
        });
      }
    }

    // Xử lý lỗi từ fileFilter
    if (err.message === "Chỉ chấp nhận file PDF") {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /clauses/:documentId - Lấy tất cả điều khoản của một văn bản
router.get("/clauses/:documentId", async (req, res) => {
  try {
    const clauses = await LegalClause.find({
      document_id: req.params.documentId,
    }).sort({ clause_number: 1 }); // Sắp xếp theo số điều

    res.json({
      success: true,
      count: clauses.length,
      clauses: clauses.map((clause) => ({
        id: clause._id,
        number: clause.clause_number,
        content: clause.clause_content,
      })),
    });
  } catch (err) {
    console.error("Get clauses error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Other CRUD routes
router.post("/", controller.create);
router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.put("/:id", controller.update);
router.delete("/:id", controller.delete);

module.exports = router;
