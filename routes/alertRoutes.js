const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createAlert,
  getUserAlerts,
  markAlertAsRead,
  deleteAlert,
  getAlertTypes,
  markAllAlertsAsRead
} = require('../controllers/alertController');

router.post('/', protect, createAlert);
router.get('/', protect, getUserAlerts);
router.put('/:id/read', protect, markAlertAsRead);
router.put('/read-all', protect, markAllAlertsAsRead);
router.delete('/:id', protect, deleteAlert);
router.get('/types', getAlertTypes);

module.exports = router;