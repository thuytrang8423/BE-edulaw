const express = require('express');
const router = express.Router();
const controller = require('../controllers/QuestionController');
const { authenticateToken, authorize } = require("../middleware/auth");

// Chỉ cho admin xem toàn bộ question
router.get('/', authenticateToken, authorize('admin'), controller.getAll);

module.exports = router;
