const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse");
const LegalDocument = require("../models/LegalDocument");
const LegalClause = require("../models/LegalClause");
const controller = require("../controllers/LegalDocumentController");
const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const { fromBuffer } = require("pdf2pic");

const upload = multer({ storage: multer.memoryStorage() });

// Helper: Xuất ra Markdown (tương tự Python script)
function exportToMarkdown(clauses, filename = "output.md") {
  let markdown = "";
  for (const clause of clauses) {
    markdown += `## ${clause.title}\n\n${clause.content}\n\n`;
  }
  return markdown;
}

// Helper: Xuất ra JSON (tương tự Python script)
function exportToJSON(clauses, filename = "output.json") {
  return JSON.stringify(clauses, null, 2);
}

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
async function preprocessImage(imagePath) {
  const processedPath = imagePath.replace(".png", "_processed.png");
  let img = sharp(imagePath).grayscale();

  // Tăng contrast mạnh (linear adjustment)
  img = img.linear(1.5, -30); // tăng slope, giảm bias để chữ nổi bật hơn

  // Làm nét
  img = img.sharpen();

  // Threshold mạnh (binarize)
  img = img.threshold(160); // cứng hơn, loại bỏ nền xám

  // Trim viền trắng dư
  img = img.trim();

  // Resize nếu ảnh nhỏ hơn 1200px chiều rộng
  const metadata = await img.metadata();
  if (metadata.width && metadata.width < 1200) {
    img = img.resize(1200);
  }

  await img.toFile(processedPath);
  return processedPath;
}

// Helper: Kiểm tra text có dấu tiếng Việt không
function hasVietnamese(text) {
  // Kiểm tra một số dấu tiếng Việt phổ biến
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text
  );
}

// Helper: Chuyển từng trang PDF thành ảnh PNG (buffer)
async function pdfToImages(pdfBuffer) {
  // Đơn giản: chỉ hỗ trợ 1 trang đầu (cần cài thêm pdf-poppler hoặc pdf2pic nếu muốn nhiều trang)
  // Ở đây chỉ demo, thực tế nên dùng thư viện chuyên dụng để chuyển PDF sang ảnh
  throw new Error(
    "Chức năng chuyển PDF sang ảnh chưa được cài đặt. Cần dùng pdf-poppler hoặc pdf2pic."
  );
}

// Helper: OCR buffer ảnh
async function ocrBuffer(imageBuffer) {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "vie+eng", { logger: (m) => {} });
  return text;
}

// POST /upload - Upload PDF, trích xuất và lưu vào database (dùng splitIntoClauses)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    // Đọc nội dung PDF từ buffer
    let data = await pdfParse(req.file.buffer);
    let text = data.text;

    // Nếu text không có dấu tiếng Việt hoặc quá ngắn, thử OCR
    if (!hasVietnamese(text) || text.length < 20) {
      // Chuyển từng trang PDF thành ảnh PNG (không lưu file tạm)
      const convert = fromBuffer(req.file.buffer, {
        density: 200,
        format: "png",
        width: 1200,
        height: 1600,
        savePath: undefined, // Không lưu file tạm
      });

      // Chuyển tối đa 5 trang đầu (hoặc toàn bộ nếu muốn)
      const totalPages = data.numpages || 1;
      let ocrText = "";
      for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        const page = await convert(i);
        console.log("pdf2pic page object:", page); // DEBUG LOG
        if (page && page.buffer) {
          ocrText += await ocrBuffer(page.buffer);
        } else if (page && page.path) {
          ocrText += await ocrBuffer(fs.readFileSync(page.path));
        } else {
          throw new Error("Không lấy được buffer hoặc path ảnh từ pdf2pic.");
        }
      }
      text = ocrText;
    }

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

    // 1. Lưu LegalDocument vào database
    const legalDocument = await LegalDocument.create({
      document_name: originalName,
      document_type: "PDF",
      document_date_issue: new Date(),
      document_signee: "System Upload",
      document_url: `uploaded/${originalName}-${timestamp}.pdf`,
    });

    // 2. Lưu từng điều khoản vào LegalClause
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
      count: clauses.length,
      document: {
        id: legalDocument._id,
        name: legalDocument.document_name,
        type: legalDocument.document_type,
        date: legalDocument.document_date_issue,
      },
      clauses: savedClauses,
      message: `✅ Đã upload, trích xuất và lưu vào database thành công. Tổng cộng ${clauses.length} điều khoản.`,
    });
  } catch (err) {
    console.error("Upload and save to database error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /export-files - Xuất ra file Markdown và JSON (tương tự Python script)
router.post("/export-files", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    // Đọc nội dung PDF từ buffer
    const data = await pdfParse(req.file.buffer);
    const text = data.text;
    const clauses = splitIntoClauses(text); // Use splitIntoClauses here

    if (!clauses.length) {
      return res.status(400).json({
        success: false,
        message: "Không trích xuất được điều khoản nào từ file PDF.",
      });
    }

    // Tạo tên file dựa trên tên file gốc
    const originalName = req.file.originalname.replace(".pdf", "");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

    // Tạo response với các file (tương tự Python script)
    const markdown = exportToMarkdown(clauses);
    const jsonData = exportToJSON(clauses);

    res.setHeader("Content-Type", "application/json");
    res.json({
      success: true,
      count: clauses.length,
      files: {
        markdown: {
          content: markdown,
          filename: `${originalName}-${timestamp}.md`,
        },
        json: {
          content: jsonData,
          filename: `${originalName}-${timestamp}.json`,
        },
        raw: {
          content: text,
          filename: `${originalName}-${timestamp}-raw.txt`,
        },
      },
      message: `✅ Đã chuyển đổi xong PDF -> Markdown và JSON. Tổng cộng ${clauses.length} điều khoản.`,
    });
  } catch (err) {
    console.error("Export files from PDF error:", err);
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

// GET /export/:documentId - Xuất document từ database ra Markdown/JSON
router.get("/export/:documentId", async (req, res) => {
  try {
    // Lấy thông tin document
    const document = await LegalDocument.findById(req.params.documentId);
    if (!document) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    // Lấy tất cả clauses
    const clauses = await LegalClause.find({
      document_id: req.params.documentId,
    }).sort({ clause_number: 1 });

    if (!clauses.length) {
      return res.status(400).json({
        success: false,
        message: "No clauses found for this document",
      });
    }

    // Chuyển đổi format để tương thích với export functions
    const formattedClauses = clauses.map((clause) => ({
      title: `Điều ${clause.clause_number}`,
      content: clause.clause_content,
    }));

    // Tạo Markdown và JSON
    const markdown = exportToMarkdown(formattedClauses);
    const jsonData = exportToJSON(formattedClauses);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

    res.json({
      success: true,
      count: clauses.length,
      document: {
        id: document._id,
        name: document.document_name,
        type: document.document_type,
        date: document.document_date_issue,
      },
      files: {
        markdown: {
          content: markdown,
          filename: `${document.document_name}-${timestamp}.md`,
        },
        json: {
          content: jsonData,
          filename: `${document.document_name}-${timestamp}.json`,
        },
      },
      message: `✅ Đã xuất document thành công. Tổng cộng ${clauses.length} điều khoản.`,
    });
  } catch (err) {
    console.error("Export document error:", err);
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
