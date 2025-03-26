const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

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
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, full_name]
    );

    if (result.affectedRows === 1) {
      const [rows] = await pool.query(
        'SELECT user_id, username, email, full_name FROM users WHERE user_id = ?',
        [result.insertId]
      );

      res.status(201).json({
        user: rows[0],
        token: generateToken(rows[0].user_id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

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
    const { username, email, full_name, password } = req.body;

    // Get user
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];

    // Update fields
    const updatedUser = {
      username: username || user.username,
      email: email || user.email,
      full_name: full_name || user.full_name,
      password: user.password,
    };

    // If password is provided, hash it
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updatedUser.password = await bcrypt.hash(password, salt);
    }

    // Handle profile image upload
    let profileImagePath = user.profile_image;
    if (req.files && req.files.profile_image) {
      const profileImage = req.files.profile_image;
      const uploadPath = `./uploads/profiles/${req.user.user_id}_${profileImage.name}`;
      
      await profileImage.mv(uploadPath);
      profileImagePath = `/uploads/profiles/${req.user.user_id}_${profileImage.name}`;
    }

    // Update user in database
    const [result] = await pool.query(
      'UPDATE users SET username = ?, email = ?, full_name = ?, password = ?, profile_image = ? WHERE user_id = ?',
      [updatedUser.username, updatedUser.email, updatedUser.full_name, updatedUser.password, profileImagePath, req.user.user_id]
    );

    if (result.affectedRows === 1) {
      const [updatedRows] = await pool.query(
        'SELECT user_id, username, email, full_name, profile_image FROM users WHERE user_id = ?',
        [req.user.user_id]
      );

      res.json(updatedRows[0]);
    } else {
      res.status(400).json({ message: 'Update failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Public
const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, username, full_name, profile_image FROM users'
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
};