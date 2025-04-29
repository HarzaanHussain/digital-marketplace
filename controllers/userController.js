const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Email validation regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    const { username, email, password, full_name } = req.body;

    if (!username || username.trim() === '') {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Username is required' });
    }
    
    if (!email || !emailRegex.test(email)) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    
    if (!password) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Password is required' });
    }
    
    // Check password strength
    if (password.length < 8) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    
    // Basic password strength check
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Password must contain at least one letter and one number'
      });
    }

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      let message = 'User already exists';
      
      // Give more specific error messages
      if (existingUser.email === email) {
        message = 'Email address is already in use';
      } else if (existingUser.username === username) {
        message = 'Username is already taken';
      }
      
      await pool.query('ROLLBACK');
      return res.status(400).json({ message });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, full_name || null]
    );

    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Failed to create user' });
    }
    
    const [rows] = await pool.query(
      'SELECT user_id, username, email, full_name FROM users WHERE user_id = ?',
      [result.insertId]
    );

    await pool.query('COMMIT');
    res.status(201).json({
      user: rows[0],
      token: generateToken(rows[0].user_id),
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Registration error:', error);
    
    // Handle unique constraint errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        message: 'Username or email already exists' 
      });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Check for user email
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

   

    res.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
      },
      token: generateToken(user.user_id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, username, email, full_name, profile_image, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    const { username, email, full_name, password } = req.body;

    // Get user
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    if (rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];

    // Validate updated email if provided
    if (email && email !== user.email) {
      if (!emailRegex.test(email)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Please provide a valid email address' });
      }
      
      // Check if email is already in use
      const [emailCheck] = await pool.query(
        'SELECT * FROM users WHERE email = ? AND user_id != ?',
        [email, req.user.user_id]
      );
      
      if (emailCheck.length > 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Email is already in use' });
      }
    }
    
    // Validate updated username if provided
    if (username && username !== user.username) {
      if (username.trim() === '') {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Username cannot be empty' });
      }
      
      // Check if username is already taken
      const [usernameCheck] = await pool.query(
        'SELECT * FROM users WHERE username = ? AND user_id != ?',
        [username, req.user.user_id]
      );
      
      if (usernameCheck.length > 0) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Update fields
    const updatedUser = {
      username: username || user.username,
      email: email || user.email,
      full_name: full_name || user.full_name,
      password: user.password,
    };

    // If password is provided, validate and hash it
    if (password) {
      // Check password strength
      if (password.length < 8) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }
      
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (!hasLetter || !hasNumber) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Password must contain at least one letter and one number'
        });
      }
      
      const salt = await bcrypt.genSalt(10);
      updatedUser.password = await bcrypt.hash(password, salt);
    }

    // Handle profile image upload
    let profileImagePath = user.profile_image;
    if (req.files && req.files.profile_image) {
      const profileImage = req.files.profile_image;
      
      // Validate it's an image
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!validImageTypes.includes(profileImage.mimetype)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: 'Profile image must be an image file' });
      }
      
      // Delete old profile image if exists
      if (user.profile_image) {
        const oldProfilePath = `./public${user.profile_image}`;
        if (fs.existsSync(oldProfilePath)) {
          fs.unlinkSync(oldProfilePath);
        }
      }
      
      // Generate unique filename
      const fileName = `${req.user.user_id}_${uuidv4()}${path.extname(profileImage.name)}`;
      profileImagePath = `/uploads/profiles/${fileName}`;
      const uploadPath = `./public/uploads/profiles/${fileName}`;
      
      // Create directory if it doesn't exist
      if (!fs.existsSync('./public/uploads/profiles')) {
        fs.mkdirSync('./public/uploads/profiles', { recursive: true });
      }
      
      try {
        await profileImage.mv(uploadPath);
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Profile image upload error:', error);
        return res.status(500).json({ message: 'Profile image upload failed' });
      }
    }

    // Update user in database
    const [result] = await pool.query(
      'UPDATE users SET username = ?, email = ?, full_name = ?, password = ?, profile_image = ? WHERE user_id = ?',
      [updatedUser.username, updatedUser.email, updatedUser.full_name, updatedUser.password, profileImagePath, req.user.user_id]
    );

    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Update failed' });
    }
    
    const [updatedRows] = await pool.query(
      'SELECT user_id, username, email, full_name, profile_image FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    await pool.query('COMMIT');
    res.json(updatedRows[0]);
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    
    // Handle unique constraint errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        message: 'Username or email already exists' 
      });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Public
const getUsers = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      'SELECT user_id, username, full_name, profile_image FROM users LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');
    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      users: rows,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user by ID (public profile)
// @route   GET /api/users/:id
// @access  Public
const getUserById = async (req, res) => {
  try {
    const [userRows] = await pool.query(
      `SELECT user_id, username, full_name, profile_image, created_at
       FROM users
       WHERE user_id = ?`,
      [req.params.id]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get item count
    const [itemCountRows] = await pool.query(
      `SELECT COUNT(*) as item_count
       FROM items
       WHERE seller_id = ? AND is_deleted = false`,
      [req.params.id]
    );
    
    // Get average rating and review count
    const [ratingRows] = await pool.query(
      `SELECT ROUND(AVG(r.rating), 1) as avg_seller_rating, COUNT(DISTINCT r.review_id) as review_count
       FROM items i
       LEFT JOIN reviews r ON i.item_id = r.item_id
       WHERE i.seller_id = ?`,
      [req.params.id]
    );
    
    // Get user's recently listed items
    const [items] = await pool.query(
      `SELECT i.*, c.name as category_name
       FROM items i
       JOIN categories c ON i.category_id = c.category_id
       WHERE i.seller_id = ? AND i.is_deleted = false
       ORDER BY i.created_at DESC
       LIMIT 5`,
      [req.params.id]
    );
    
    const userData = {
      ...userRows[0],
      item_count: itemCountRows[0].item_count,
      avg_seller_rating: ratingRows[0].avg_seller_rating || 0,
      review_count: ratingRows[0].review_count || 0,
      recent_items: items
    };
    
    res.json(userData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};



// @desc    Delete user account
// @route   DELETE /api/users
// @access  Private
const deleteUser = async (req, res) => {
  try {
    await pool.query('START TRANSACTION');
    
    // Get user ID
    const userId = req.user.user_id;
    
    await pool.query(
      'DELETE FROM user_alerts WHERE user_id = ?',
      [userId]
    );
    
    await pool.query(
      'DELETE FROM reviews WHERE reviewer_id = ?',
      [userId]
    );
    
    await pool.query(
      'UPDATE items SET is_deleted = true WHERE seller_id = ?',
      [userId]
    );
    
    try {
      // Check if seller_notifications table exists first
      const [tableCheck] = await pool.query(`
        SELECT COUNT(*) as table_exists
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name = 'seller_notifications'
      `);
      
      if (tableCheck[0].table_exists > 0) {
        await pool.query(
          'DELETE FROM seller_notifications WHERE seller_id = ?',
          [userId]
        );
      }
    } catch (error) {
      console.error('Error handling seller notifications:', error);
      // Continue with deletion even if this fails
    }
    
    const [userRows] = await pool.query(
      'SELECT profile_image FROM users WHERE user_id = ?',
      [userId]
    );
    
    let profileImagePath = null;
    if (userRows.length > 0 && userRows[0].profile_image) {
      profileImagePath = userRows[0].profile_image;
    }
    
    const [result] = await pool.query(
      'DELETE FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (result.affectedRows !== 1) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Failed to delete account' });
    }
    
    if (profileImagePath) {
      try {
        const fullPath = path.join(__dirname, '..', 'public', profileImagePath.startsWith('/') ? profileImagePath.substring(1) : profileImagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (error) {
        console.error('Failed to delete profile image:', error);
        // Continue with deletion even if this fails
      }
    }
    
    await pool.query('COMMIT');
    res.json({ message: 'Account deleted successfully' });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting user account:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  getUserById,
  deleteUser
};