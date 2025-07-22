const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const LegalDocument = require('../models/LegalDocument');
const LegalClause = require('../models/LegalClause');
const controller = require('../controllers/LegalDocumentController');

const upload = multer({ dest: 'uploads/' });

// Helper: Tách điều khoản bằng nhiều pattern mạnh nhất có thể
function extractClauses(text) {
  // Làm sạch text: loại bỏ ký tự lạ, chuẩn hóa xuống dòng
  text = text.replace(/\r/g, '\n').replace(/\n{2,}/g, '\n');

  // Các pattern phổ biến nhất cho luật Việt Nam
  const regexes = [
    // Điều X. hoặc Điều X:
    /(Điều\s+\d+[.:  - – —]?)([\s\S]*?)(?=\n?Điều\s+\d+[.:  - – —]?|$)/g,
    // Điều X xuống dòng
    /(Điều\s+\d+)[\s\S]*?\n([\s\S]*?)(?=\nĐiều\s+\d+|$)/g,
    // Dòng bắt đầu bằng Điều X (fallback)
    /(^Điều\s+\d+.*$)([\s\S]*?)(?=^Điều\s+\d+.*$|\Z)/gm
  ];
  for (const regex of regexes) {
    let match;
    const clauses = [];
    while ((match = regex.exec(text)) !== null) {
      let clause_number = match[1].replace(/\n|\r|\s+$/g, '').trim();
      let clause_content = (match[2] || '').replace(/\n{2,}/g, '\n').trim();
      // Loại bỏ các điều khoản quá ngắn hoặc không hợp lệ
      if (clause_content.length > 10) {
        clauses.push({ clause_number, clause_content });
      }
    }
    if (clauses.length > 0) return clauses;
  }
  return [];
}

// CRUD routes
router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

// Upload PDF, extract, and save clauses
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { document_name, document_type, document_date_issue, document_signee } = req.body;
    // 1. Lưu thông tin văn bản
    const legalDoc = await LegalDocument.create({
      document_name, document_type, document_date_issue, document_signee
    });
    // 2. Đọc file PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);
    // 3. Tách điều khoản bằng nhiều pattern mạnh nhất
    const clauses = extractClauses(data.text);
    for (let i = 0; i < clauses.length; i++) {
      await LegalClause.create({
        clause_number: clauses[i].clause_number || (i + 1).toString(),
        clause_content: clauses[i].clause_content,
        document_id: legalDoc._id
      });
    }
    // Xóa file tạm
    fs.unlinkSync(req.file.path);
    // Log debug
    console.log('Số điều khoản:', clauses.length);
    if (clauses.length > 0) {
      console.log('Ví dụ điều khoản:', clauses[0]);
    } else {
      console.log('Không tách được điều khoản!');
    }
    console.log('PDF TEXT:', data.text);
    console.log('CLAUSES:', clauses);
    res.json({ message: 'Upload và trích xuất thành công', document: legalDoc, clauses_saved: clauses.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
