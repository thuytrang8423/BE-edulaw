const express = require('express');
const router = express.Router();
const controller = require('../controllers/LegalClauseController');

router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.get('/search', controller.search);
module.exports = router;
