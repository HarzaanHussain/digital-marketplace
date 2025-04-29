const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getCategories,
  getCategoryById,
  createCategory
} = require('../controllers/categoryController');

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', protect, createCategory); 

module.exports = router;