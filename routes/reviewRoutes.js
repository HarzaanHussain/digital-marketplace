const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createReview,
  getItemReviews,
  updateReview,
  deleteReview
} = require('../controllers/reviewController');

router.post('/', protect, createReview);
router.get('/item/:id', getItemReviews);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;