const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  registerUser, 
  loginUser, 
  getUserProfile,
  updateUserProfile,
  getUsers,
  getUserById
} = require('../controllers/userController');

router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.get('/', getUsers);
router.get('/:id', getUserById);

module.exports = router;