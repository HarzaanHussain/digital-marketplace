const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createReview,
  getItemReviews,
  updateReview,
  deleteReview,
  getUserReviews
} = require('../controllers/reviewController');

router.post('/', protect, createReview);
router.get('/item/:id', getItemReviews);
router.get('/user', protect, getUserReviews);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;