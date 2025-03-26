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
router.post('/', protect, createCategory); // In a real app, you'd add isAdmin middleware

module.exports = router;