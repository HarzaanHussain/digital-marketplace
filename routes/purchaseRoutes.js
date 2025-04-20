const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createPurchase,
  getUserPurchases,
  getUserSales,
  downloadPurchasedItem,
  getSellerNotifications,
  markNotificationAsRead
} = require('../controllers/purchaseController');

router.post('/', protect, createPurchase);
router.get('/', protect, getUserPurchases);
router.get('/sales', protect, getUserSales);
router.get('/notifications', protect, getSellerNotifications);
router.put('/notifications/:id/read', protect, markNotificationAsRead);
router.get('/:id/download', protect, downloadPurchasedItem);

module.exports = router;