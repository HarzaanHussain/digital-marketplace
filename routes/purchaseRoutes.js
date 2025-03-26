const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createPurchase,
  getUserPurchases,
  getUserSales,
  downloadPurchasedItem
} = require('../controllers/purchaseController');

router.post('/', protect, createPurchase);
router.get('/', protect, getUserPurchases);
router.get('/sales', protect, getUserSales);
router.get('/:id/download', protect, downloadPurchasedItem);

module.exports = router;